import type { InStatement, InValue } from '@libsql/client';
import { all, batch, get, stmt } from './db';
import { shortId, secretToken, slugify } from './ids';
import { cleanEmail, cleanPhone } from './contact';
import type { EventInput } from './schemas';
import type { Notify, Source } from './channels';

export type EventRow = {
  id: string;
  slug: string;
  host_id: string;
  title: string;
  description: string;
  banner_preset: string;
  banner_image: string | null;
  accent: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  location_name: string;
  location_address: string;
  online_url: string;
  has_fee: number;
  fee_cents: number;
  fee_currency: string;
  fee_note: string;
  bring_note: string;
  dress_code: string;
  capacity: number | null;
  max_plus_ones: number;
  rsvp_deadline: string | null;
  allow_maybe: number;
  show_guest_list: number;
  invite_only: number;
  /** The host's message sent ahead of invite links; null means use the default. */
  invite_note: string | null;
  /** JSON array of strings; read it with parseFeatures. */
  features: string;
  created_at: string;
  updated_at: string;
};

export type RsvpStatus = 'going' | 'maybe' | 'declined';

export type RsvpRow = {
  id: string;
  event_id: string;
  person_id: string;
  status: RsvpStatus;
  plus_ones: number;
  note: string;
  source: Source;
  notify: Notify;
  invitee_id: string | null;
  created_at: string;
  updated_at: string;
};


export function parseFeatures(e: Pick<EventRow, 'features'>): string[] {
  try {
    const list = JSON.parse(e.features ?? '[]');
    return Array.isArray(list) ? list.filter((f): f is string => typeof f === 'string') : [];
  } catch {
    return [];
  }
}

export function getEvent(id: string): Promise<EventRow | null> {
  return get<EventRow>('SELECT * FROM events WHERE id = ?', id);
}

export function getEventBySlug(slug: string): Promise<EventRow | null> {
  return get<EventRow>('SELECT * FROM events WHERE slug = ?', slug);
}

export function getRsvp(eventId: string, personId: string): Promise<RsvpRow | null> {
  return get<RsvpRow>('SELECT * FROM rsvps WHERE event_id = ? AND person_id = ?', eventId, personId);
}

export type Stats = { going: number; maybe: number; declined: number; headcount: number; invited: number; awaiting: number };

export async function eventStats(eventId: string): Promise<Stats> {
  const [r, inv] = await Promise.all([
    get<{ going: number; maybe: number; declined: number; headcount: number }>(
      `SELECT
         COALESCE(SUM(status = 'going'), 0) AS going,
         COALESCE(SUM(status = 'maybe'), 0) AS maybe,
         COALESCE(SUM(status = 'declined'), 0) AS declined,
         COALESCE(SUM(CASE WHEN status = 'going' THEN 1 + plus_ones END), 0) AS headcount
       FROM rsvps WHERE event_id = ?`,
      eventId,
    ),
    get<{ invited: number; awaiting: number }>(
      `SELECT COUNT(*) AS invited,
         COALESCE(SUM(CASE WHEN NOT EXISTS (
           SELECT 1 FROM rsvps r WHERE r.event_id = i.event_id
             AND (r.invitee_id = i.id OR (i.person_id IS NOT NULL AND r.person_id = i.person_id))
         ) THEN 1 ELSE 0 END), 0) AS awaiting
       FROM invitees i WHERE i.event_id = ?`,
      eventId,
    ),
  ]);
  return { ...r!, ...inv! };
}

export type GuestView = {
  person_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  is_account: number;
  status: RsvpStatus;
  plus_ones: number;
  note: string;
  source: Source;
  notify: Notify;
  invitee_name: string | null;
  updated_at: string;
};

export function listGuests(eventId: string): Promise<GuestView[]> {
  return all<GuestView>(
    `SELECT r.person_id, p.first_name, p.last_name, p.phone, p.email, (p.password_hash IS NOT NULL) AS is_account,
            r.status, r.plus_ones, r.note, r.source, r.notify, i.name AS invitee_name, r.updated_at
     FROM rsvps r
     JOIN people p ON p.id = r.person_id
     LEFT JOIN invitees i ON i.id = r.invitee_id
     WHERE r.event_id = ?
     ORDER BY CASE r.status WHEN 'going' THEN 0 WHEN 'maybe' THEN 1 ELSE 2 END, r.updated_at DESC`,
    eventId,
  );
}

export type ItemView = {
  id: string;
  name: string;
  quantity: number;
  note: string;
  claimed: number;
  claims: { person_id: string; first_name: string; last_name: string; quantity: number }[];
};

export async function listItems(eventId: string): Promise<ItemView[]> {
  const [items, claims] = await Promise.all([
    all<Omit<ItemView, 'claimed' | 'claims'>>('SELECT id, name, quantity, note FROM items WHERE event_id = ? ORDER BY sort, rowid', eventId),
    all<ItemView['claims'][number] & { item_id: string }>(
      `SELECT c.item_id, c.person_id, c.quantity, p.first_name, p.last_name
       FROM item_claims c JOIN items it ON it.id = c.item_id JOIN people p ON p.id = c.person_id
       WHERE it.event_id = ? ORDER BY c.created_at`,
      eventId,
    ),
  ]);
  return items.map((it) => {
    const mine = claims.filter((c) => c.item_id === it.id).map(({ item_id: _skip, ...c }) => c);
    return { ...it, claims: mine, claimed: mine.reduce((n, c) => n + c.quantity, 0) };
  });
}

export type ExtraView = { id: string; person_id: string; first_name: string; last_name: string; name: string };

export function listExtras(eventId: string): Promise<ExtraView[]> {
  return all<ExtraView>(
    `SELECT x.id, x.person_id, p.first_name, p.last_name, x.name
     FROM guest_extras x JOIN people p ON p.id = x.person_id
     WHERE x.event_id = ? ORDER BY x.created_at, x.rowid`,
    eventId,
  );
}

export type InviteeView = {
  id: string;
  name: string;
  phone: string;
  email: string;
  token: string;
  status: RsvpStatus | null;
};

export function listInvitees(eventId: string): Promise<InviteeView[]> {
  return all<InviteeView>(
    `SELECT i.id, i.name, i.phone, i.email, i.token,
       (SELECT r.status FROM rsvps r WHERE r.event_id = i.event_id
          AND (r.invitee_id = i.id OR (i.person_id IS NOT NULL AND r.person_id = i.person_id)) LIMIT 1) AS status
     FROM invitees i WHERE i.event_id = ? ORDER BY i.sort, i.rowid`,
    eventId,
  );
}

export function getInviteeByToken(eventId: string, token: string) {
  return get<{ id: string; name: string; phone: string; email: string; person_id: string | null }>(
    'SELECT id, name, phone, email, person_id FROM invitees WHERE event_id = ? AND token = ?',
    eventId,
    token,
  );
}

export async function isInvitedPerson(eventId: string, personId: string): Promise<boolean> {
  return !!(await get('SELECT 1 AS yes FROM invitees WHERE event_id = ? AND person_id = ?', eventId, personId));
}

export type UpdateView = { id: string; message: string; created_at: string; sent: number; logged: number; failed: number; skipped: number };

export function listUpdates(eventId: string): Promise<UpdateView[]> {
  return all<UpdateView>(
    `SELECT u.id, u.message, u.created_at,
       COALESCE(SUM(d.status = 'sent'), 0) AS sent,
       COALESCE(SUM(d.status = 'logged'), 0) AS logged,
       COALESCE(SUM(d.status = 'failed'), 0) AS failed,
       COALESCE(SUM(d.status = 'skipped'), 0) AS skipped
     FROM updates u LEFT JOIN deliveries d ON d.update_id = u.id
     WHERE u.event_id = ? GROUP BY u.id ORDER BY u.created_at DESC, u.rowid DESC`,
    eventId,
  );
}

export function sourceBreakdown(eventId: string): Promise<{ source: Source; count: number }[]> {
  return all(`SELECT source, COUNT(*) AS count FROM rsvps WHERE event_id = ? AND status != 'declined' GROUP BY source ORDER BY count DESC`, eventId);
}

export type EventSummary = EventRow & Stats;

export async function hostedEvents(personId: string): Promise<EventSummary[]> {
  const rows = await all<EventRow>('SELECT * FROM events WHERE host_id = ? ORDER BY starts_at DESC', personId);
  return Promise.all(rows.map(async (e) => ({ ...e, ...(await eventStats(e.id)) })));
}

export function attendingEvents(personId: string): Promise<(EventRow & { status: RsvpStatus })[]> {
  return all(
    `SELECT e.*, r.status FROM rsvps r JOIN events e ON e.id = r.event_id
     WHERE r.person_id = ? AND e.host_id != ? ORDER BY e.starts_at DESC`,
    personId,
    personId,
  );
}

async function itemStatements(eventId: string, items: EventInput['items']): Promise<InStatement[]> {
  const existing = new Set((await all<{ id: string }>('SELECT id FROM items WHERE event_id = ?', eventId)).map((r) => r.id));
  const keep = new Set<string>();
  const out: InStatement[] = [];
  items.forEach((it, sort) => {
    if (it.id && existing.has(it.id)) {
      out.push(stmt('UPDATE items SET name = ?, quantity = ?, note = ?, sort = ? WHERE id = ?', it.name, it.quantity, it.note, sort, it.id));
      keep.add(it.id);
    } else {
      out.push(stmt('INSERT INTO items (id, event_id, name, quantity, note, sort) VALUES (?, ?, ?, ?, ?, ?)', shortId(12), eventId, it.name, it.quantity, it.note, sort));
    }
  });
  for (const id of existing) {
    if (keep.has(id)) continue;
    out.push(stmt('DELETE FROM item_claims WHERE item_id = ?', id), stmt('DELETE FROM items WHERE id = ?', id));
  }
  return out;
}

async function inviteeStatements(eventId: string, invitees: EventInput['invitees']): Promise<InStatement[]> {
  const existing = new Set((await all<{ id: string }>('SELECT id FROM invitees WHERE event_id = ?', eventId)).map((r) => r.id));
  const keep = new Set<string>();
  const out: InStatement[] = [];
  invitees.forEach((inv, sort) => {
    const phone = cleanPhone(inv.phone).value ?? inv.phone;
    const email = cleanEmail(inv.email).value ?? inv.email;
    if (inv.id && existing.has(inv.id)) {
      out.push(stmt('UPDATE invitees SET name = ?, phone = ?, email = ?, sort = ? WHERE id = ?', inv.name, phone, email, sort, inv.id));
      keep.add(inv.id);
    } else {
      out.push(stmt('INSERT INTO invitees (id, event_id, name, phone, email, token, sort) VALUES (?, ?, ?, ?, ?, ?, ?)', shortId(12), eventId, inv.name, phone, email, secretToken(12), sort));
    }
  });
  for (const id of existing) {
    if (keep.has(id)) continue;
    out.push(stmt('UPDATE rsvps SET invitee_id = NULL WHERE invitee_id = ?', id), stmt('DELETE FROM invitees WHERE id = ?', id));
  }
  return out;
}

export async function saveEvent(hostId: string, input: EventInput, existing?: EventRow): Promise<string> {
  const id = existing?.id ?? shortId(12);
  const cols: Record<string, InValue> = {
    title: input.title,
    description: input.description,
    banner_preset: input.bannerPreset,
    accent: input.accent,
    starts_at: input.startsAt,
    ends_at: input.endsAt || null,
    timezone: input.timezone,
    location_name: input.locationName,
    location_address: input.locationAddress,
    online_url: input.onlineUrl,
    has_fee: input.hasFee ? 1 : 0,
    fee_cents: input.hasFee ? Math.round(input.feeAmount * 100) : 0,
    fee_currency: input.feeCurrency,
    fee_note: input.hasFee ? input.feeNote : '',
    bring_note: input.bringNote,
    dress_code: input.dressCode,
    capacity: input.capacity,
    max_plus_ones: input.maxPlusOnes,
    rsvp_deadline: input.rsvpDeadline || null,
    allow_maybe: input.allowMaybe ? 1 : 0,
    show_guest_list: input.showGuestList ? 1 : 0,
    invite_only: input.inviteOnly ? 1 : 0,
    features: JSON.stringify(input.features),
  };
  const keys = Object.keys(cols);
  const values = Object.values(cols);

  const statements: InStatement[] = [
    existing
      ? stmt(`UPDATE events SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`, ...values, id)
      : stmt(`INSERT INTO events (id, slug, host_id, ${keys.join(', ')}) VALUES (?, ?, ?, ${keys.map(() => '?').join(', ')})`, id, slugify(input.title), hostId, ...values),
  ];
  if (input.bannerImage !== undefined) statements.push(stmt('UPDATE events SET banner_image = ? WHERE id = ?', input.bannerImage, id));
  statements.push(...(await itemStatements(id, input.items)), ...(await inviteeStatements(id, input.invitees)));
  await batch(statements);
  return id;
}

export async function deleteEvent(id: string): Promise<void> {
  await batch([
    stmt('DELETE FROM deliveries WHERE event_id = ?', id),
    stmt('DELETE FROM updates WHERE event_id = ?', id),
    stmt('DELETE FROM item_claims WHERE item_id IN (SELECT id FROM items WHERE event_id = ?)', id),
    stmt('DELETE FROM items WHERE event_id = ?', id),
    stmt('DELETE FROM guest_extras WHERE event_id = ?', id),
    stmt('DELETE FROM rsvps WHERE event_id = ?', id),
    stmt('DELETE FROM invitees WHERE event_id = ?', id),
    stmt('DELETE FROM events WHERE id = ?', id),
  ]);
}
