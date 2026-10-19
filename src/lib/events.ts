import { db } from './db';
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

export function getEvent(id: string): EventRow | null {
  return (db.prepare('SELECT * FROM events WHERE id = ?').get(id) as EventRow | undefined) ?? null;
}

export function getEventBySlug(slug: string): EventRow | null {
  return (db.prepare('SELECT * FROM events WHERE slug = ?').get(slug) as EventRow | undefined) ?? null;
}

export function getRsvp(eventId: string, personId: string): RsvpRow | null {
  return (db.prepare('SELECT * FROM rsvps WHERE event_id = ? AND person_id = ?').get(eventId, personId) as RsvpRow | undefined) ?? null;
}

export type Stats = { going: number; maybe: number; declined: number; headcount: number; invited: number; awaiting: number };

export function eventStats(eventId: string): Stats {
  const r = db
    .prepare(
      `SELECT
         COALESCE(SUM(status = 'going'), 0) AS going,
         COALESCE(SUM(status = 'maybe'), 0) AS maybe,
         COALESCE(SUM(status = 'declined'), 0) AS declined,
         COALESCE(SUM(CASE WHEN status = 'going' THEN 1 + plus_ones END), 0) AS headcount
       FROM rsvps WHERE event_id = ?`,
    )
    .get(eventId) as { going: number; maybe: number; declined: number; headcount: number };
  const inv = db
    .prepare(
      `SELECT COUNT(*) AS invited,
         COALESCE(SUM(CASE WHEN NOT EXISTS (
           SELECT 1 FROM rsvps r WHERE r.event_id = i.event_id
             AND (r.invitee_id = i.id OR (i.person_id IS NOT NULL AND r.person_id = i.person_id))
         ) THEN 1 ELSE 0 END), 0) AS awaiting
       FROM invitees i WHERE i.event_id = ?`,
    )
    .get(eventId) as { invited: number; awaiting: number };
  return { ...r, ...inv };
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

export function listGuests(eventId: string): GuestView[] {
  return db
    .prepare(
      `SELECT r.person_id, p.first_name, p.last_name, p.phone, p.email, (p.password_hash IS NOT NULL) AS is_account,
              r.status, r.plus_ones, r.note, r.source, r.notify, i.name AS invitee_name, r.updated_at
       FROM rsvps r
       JOIN people p ON p.id = r.person_id
       LEFT JOIN invitees i ON i.id = r.invitee_id
       WHERE r.event_id = ?
       ORDER BY CASE r.status WHEN 'going' THEN 0 WHEN 'maybe' THEN 1 ELSE 2 END, r.updated_at DESC`,
    )
    .all(eventId) as GuestView[];
}

export type ItemView = {
  id: string;
  name: string;
  quantity: number;
  note: string;
  claimed: number;
  claims: { person_id: string; first_name: string; last_name: string; quantity: number }[];
};

export function listItems(eventId: string): ItemView[] {
  const items = db.prepare('SELECT id, name, quantity, note FROM items WHERE event_id = ? ORDER BY sort, rowid').all(eventId) as Omit<ItemView, 'claimed' | 'claims'>[];
  const claims = db
    .prepare(
      `SELECT c.item_id, c.person_id, c.quantity, p.first_name, p.last_name
       FROM item_claims c JOIN items it ON it.id = c.item_id JOIN people p ON p.id = c.person_id
       WHERE it.event_id = ? ORDER BY c.created_at`,
    )
    .all(eventId) as (ItemView['claims'][number] & { item_id: string })[];
  return items.map((it) => {
    const mine = claims.filter((c) => c.item_id === it.id).map(({ item_id: _skip, ...c }) => c);
    return { ...it, claims: mine, claimed: mine.reduce((n, c) => n + c.quantity, 0) };
  });
}

export type InviteeView = {
  id: string;
  name: string;
  phone: string;
  email: string;
  token: string;
  status: RsvpStatus | null;
};

export function listInvitees(eventId: string): InviteeView[] {
  return db
    .prepare(
      `SELECT i.id, i.name, i.phone, i.email, i.token,
         (SELECT r.status FROM rsvps r WHERE r.event_id = i.event_id
            AND (r.invitee_id = i.id OR (i.person_id IS NOT NULL AND r.person_id = i.person_id)) LIMIT 1) AS status
       FROM invitees i WHERE i.event_id = ? ORDER BY i.sort, i.rowid`,
    )
    .all(eventId) as InviteeView[];
}

export function getInviteeByToken(eventId: string, token: string) {
  return (
    (db.prepare('SELECT id, name, phone, email, person_id FROM invitees WHERE event_id = ? AND token = ?').get(eventId, token) as
      | { id: string; name: string; phone: string; email: string; person_id: string | null }
      | undefined) ?? null
  );
}

export function isInvitedPerson(eventId: string, personId: string): boolean {
  return !!db.prepare('SELECT 1 FROM invitees WHERE event_id = ? AND person_id = ?').get(eventId, personId);
}

export type UpdateView = { id: string; message: string; created_at: string; sent: number; logged: number; failed: number; skipped: number };

export function listUpdates(eventId: string): UpdateView[] {
  return db
    .prepare(
      `SELECT u.id, u.message, u.created_at,
         COALESCE(SUM(d.status = 'sent'), 0) AS sent,
         COALESCE(SUM(d.status = 'logged'), 0) AS logged,
         COALESCE(SUM(d.status = 'failed'), 0) AS failed,
         COALESCE(SUM(d.status = 'skipped'), 0) AS skipped
       FROM updates u LEFT JOIN deliveries d ON d.update_id = u.id
       WHERE u.event_id = ? GROUP BY u.id ORDER BY u.created_at DESC, u.rowid DESC`,
    )
    .all(eventId) as UpdateView[];
}

export function sourceBreakdown(eventId: string): { source: Source; count: number }[] {
  return db
    .prepare(`SELECT source, COUNT(*) AS count FROM rsvps WHERE event_id = ? AND status != 'declined' GROUP BY source ORDER BY count DESC`)
    .all(eventId) as { source: Source; count: number }[];
}

export type EventSummary = EventRow & Stats;

export function hostedEvents(personId: string): EventSummary[] {
  const rows = db.prepare('SELECT * FROM events WHERE host_id = ? ORDER BY starts_at DESC').all(personId) as EventRow[];
  return rows.map((e) => ({ ...e, ...eventStats(e.id) }));
}

export function attendingEvents(personId: string): (EventRow & { status: RsvpStatus })[] {
  return db
    .prepare(
      `SELECT e.*, r.status FROM rsvps r JOIN events e ON e.id = r.event_id
       WHERE r.person_id = ? AND e.host_id != ? ORDER BY e.starts_at DESC`,
    )
    .all(personId, personId) as (EventRow & { status: RsvpStatus })[];
}

function syncItems(eventId: string, items: EventInput['items']) {
  const existing = new Set((db.prepare('SELECT id FROM items WHERE event_id = ?').all(eventId) as { id: string }[]).map((r) => r.id));
  const keep = new Set<string>();
  items.forEach((it, sort) => {
    if (it.id && existing.has(it.id)) {
      db.prepare('UPDATE items SET name = ?, quantity = ?, note = ?, sort = ? WHERE id = ?').run(it.name, it.quantity, it.note, sort, it.id);
      keep.add(it.id);
    } else {
      db.prepare('INSERT INTO items (id, event_id, name, quantity, note, sort) VALUES (?, ?, ?, ?, ?, ?)').run(shortId(12), eventId, it.name, it.quantity, it.note, sort);
    }
  });
  for (const id of existing) if (!keep.has(id)) db.prepare('DELETE FROM items WHERE id = ?').run(id);
}

function syncInvitees(eventId: string, invitees: EventInput['invitees']) {
  const existing = new Set((db.prepare('SELECT id FROM invitees WHERE event_id = ?').all(eventId) as { id: string }[]).map((r) => r.id));
  const keep = new Set<string>();
  invitees.forEach((inv, sort) => {
    const phone = cleanPhone(inv.phone).value ?? inv.phone;
    const email = cleanEmail(inv.email).value ?? inv.email;
    if (inv.id && existing.has(inv.id)) {
      db.prepare('UPDATE invitees SET name = ?, phone = ?, email = ?, sort = ? WHERE id = ?').run(inv.name, phone, email, sort, inv.id);
      keep.add(inv.id);
    } else {
      db.prepare('INSERT INTO invitees (id, event_id, name, phone, email, token, sort) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        shortId(12),
        eventId,
        inv.name,
        phone,
        email,
        secretToken(12),
        sort,
      );
    }
  });
  for (const id of existing) if (!keep.has(id)) db.prepare('DELETE FROM invitees WHERE id = ?').run(id);
}

export function saveEvent(hostId: string, input: EventInput, existing?: EventRow): string {
  return db.transaction(() => {
    const id = existing?.id ?? shortId(12);
    const cols = {
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
    };
    const keys = Object.keys(cols);
    if (existing) {
      db.prepare(`UPDATE events SET ${keys.map((k) => `${k} = @${k}`).join(', ')}, updated_at = datetime('now') WHERE id = @id`).run({ ...cols, id });
    } else {
      db.prepare(`INSERT INTO events (id, slug, host_id, ${keys.join(', ')}) VALUES (@id, @slug, @host_id, ${keys.map((k) => `@${k}`).join(', ')})`).run({
        ...cols,
        id,
        slug: slugify(input.title),
        host_id: hostId,
      });
    }
    if (input.bannerImage !== undefined) db.prepare('UPDATE events SET banner_image = ? WHERE id = ?').run(input.bannerImage, id);
    syncItems(id, input.items);
    syncInvitees(id, input.invitees);
    return id;
  })();
}
