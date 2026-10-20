import { NextResponse } from 'next/server';
import type { InStatement } from '@libsql/client';
import { batch, get, stmt } from '@/lib/db';
import { currentPerson, getPerson } from '@/lib/auth';
import { fail, parseBody } from '@/lib/api';
import { rsvpSchema } from '@/lib/schemas';
import { getEvent, getInviteeByToken, getRsvp, isInvitedPerson } from '@/lib/events';
import { cleanEmail, cleanPhone } from '@/lib/contact';
import { needsPhone } from '@/lib/channels';
import { formatDeadline, zonedToUtc } from '@/lib/format';
import { shortId } from '@/lib/ids';
import { sendRsvpConfirmation } from '@/lib/notify';
import { appOrigin } from '@/lib/origin';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const [me, event] = await Promise.all([currentPerson(), getEvent(params.id)]);
  if (!me) return fail('Add your name before you RSVP.', 401);
  if (!event) return fail('That event no longer exists.', 404);

  const { data, error } = await parseBody(req, rsvpSchema);
  if (error) return error;

  const isHost = me.id === event.host_id;
  const existing = await getRsvp(event.id, me.id);

  if (event.rsvp_deadline && !isHost && zonedToUtc(event.rsvp_deadline, event.timezone).getTime() < Date.now()) {
    return fail(`RSVPs closed on ${formatDeadline(event.rsvp_deadline)}. Contact the host to make changes.`, 403);
  }
  if (data.status === 'maybe' && !event.allow_maybe) return fail('The host asked for a yes or no for this event.');
  if (data.plusOnes > event.max_plus_ones) {
    return fail(event.max_plus_ones ? `You can bring up to ${event.max_plus_ones} extra guest${event.max_plus_ones === 1 ? '' : 's'}.` : 'This event doesn’t allow extra guests.');
  }
  const plusOnes = data.status === 'declined' ? 0 : data.plusOnes;

  const invitee = data.inviteToken ? await getInviteeByToken(event.id, data.inviteToken) : null;
  if (event.invite_only && !isHost && !invitee && !existing && !(await isInvitedPerson(event.id, me.id))) {
    return fail('This event is invite-only. Ask the host for your personal invite link.', 403);
  }

  if (data.status === 'going' && event.capacity) {
    const { n } = (await get<{ n: number }>(
      `SELECT COALESCE(SUM(1 + plus_ones), 0) AS n FROM rsvps WHERE event_id = ? AND status = 'going' AND person_id != ?`,
      event.id,
      me.id,
    ))!;
    if (n + 1 + plusOnes > event.capacity) {
      const left = Math.max(0, event.capacity - n);
      return fail(left ? `Only ${left} spot${left === 1 ? '' : 's'} left, including you.` : 'This event is full.', 409);
    }
  }

  // Contact details for updates. Account emails are logins, so only fill them in when missing.
  let phone = me.phone;
  let email = me.email;
  if (data.phone) {
    const c = cleanPhone(data.phone);
    if (c.error) return fail(c.error);
    phone = c.value;
  }
  if (data.email && (!me.password_hash || !me.email)) {
    const c = cleanEmail(data.email);
    if (c.error) return fail(c.error);
    email = c.value;
  }
  if (needsPhone(data.notify) && !phone) return fail('Add a mobile number so we can send you updates, or pick another option.');
  if (data.notify === 'email' && !email) return fail('Add an email address so we can send you updates, or pick another option.');

  const statements: InStatement[] = [
    stmt('UPDATE people SET phone = ?, email = ? WHERE id = ?', phone, email, me.id),
    stmt(
      `INSERT INTO rsvps (id, event_id, person_id, status, plus_ones, note, source, notify, invitee_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (event_id, person_id) DO UPDATE SET
         status = excluded.status, plus_ones = excluded.plus_ones, note = excluded.note, notify = excluded.notify,
         invitee_id = COALESCE(rsvps.invitee_id, excluded.invitee_id), updated_at = datetime('now')`,
      shortId(12),
      event.id,
      me.id,
      data.status,
      plusOnes,
      data.note,
      data.source,
      data.notify,
      invitee?.id ?? null,
    ),
  ];
  if (invitee && !invitee.person_id) statements.push(stmt('UPDATE invitees SET person_id = ? WHERE id = ?', me.id, invitee.id));
  if (data.status === 'declined') {
    statements.push(stmt('DELETE FROM item_claims WHERE person_id = ? AND item_id IN (SELECT id FROM items WHERE event_id = ?)', me.id, event.id));
    statements.push(stmt('DELETE FROM guest_extras WHERE person_id = ? AND event_id = ?', me.id, event.id));
  }
  await batch(statements);

  // Confirm the first RSVP, or a change of mind, on the guest's chosen channel.
  if (!isHost && (!existing || existing.status !== data.status)) {
    await sendRsvpConfirmation(event, (await getPerson(me.id))!, data.status, data.notify, appOrigin());
  }

  return NextResponse.json({ ok: true });
}
