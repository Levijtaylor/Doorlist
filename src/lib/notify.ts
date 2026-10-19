import { all, run } from './db';
import { shortId } from './ids';
import type { Person } from './auth';
import type { EventRow } from './events';
import type { Notify } from './channels';
import { formatWhen } from './format';

type Status = 'sent' | 'logged' | 'failed' | 'skipped';
export type Outcome = { channel: Notify; destination: string; status: Status; detail: string };
export type DeliverySummary = Record<Status, number> & { total: number };

async function sendTwilio(to: string, body: string, whatsapp: boolean): Promise<Outcome> {
  const channel: Notify = whatsapp ? 'whatsapp' : 'sms';
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = whatsapp ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.log(`[doorlist] ${channel} to ${to} (Twilio not configured):\n${body}\n`);
    return { channel, destination: to, status: 'logged', detail: 'Twilio is not set up, so the message was written to the server log.' };
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: whatsapp ? `whatsapp:${to}` : to,
        From: whatsapp ? `whatsapp:${from}` : from,
        Body: body,
      }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string } | null;
      return { channel, destination: to, status: 'failed', detail: err?.message ?? `Twilio returned ${res.status}` };
    }
    return { channel, destination: to, status: 'sent', detail: '' };
  } catch (e) {
    return { channel, destination: to, status: 'failed', detail: e instanceof Error ? e.message : 'Network error' };
  }
}

async function sendEmail(to: string, subject: string, text: string): Promise<Outcome> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.log(`[doorlist] email to ${to} (Resend not configured): ${subject}\n${text}\n`);
    return { channel: 'email', destination: to, status: 'logged', detail: 'Email is not set up, so the message was written to the server log.' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string } | null;
      return { channel: 'email', destination: to, status: 'failed', detail: err?.message ?? `Resend returned ${res.status}` };
    }
    return { channel: 'email', destination: to, status: 'sent', detail: '' };
  } catch (e) {
    return { channel: 'email', destination: to, status: 'failed', detail: e instanceof Error ? e.message : 'Network error' };
  }
}

export async function sendTo(person: Pick<Person, 'phone' | 'email'>, notify: Notify, subject: string, body: string): Promise<Outcome> {
  if (notify === 'none') return { channel: 'none', destination: '', status: 'skipped', detail: 'Guest chose to check the event page instead.' };
  if (notify === 'email') {
    if (!person.email) return { channel: 'email', destination: '', status: 'skipped', detail: 'No email address on file.' };
    return sendEmail(person.email, subject, body);
  }
  if (!person.phone) return { channel: notify, destination: '', status: 'skipped', detail: 'No mobile number on file.' };
  return sendTwilio(person.phone, body, notify === 'whatsapp');
}

/** Guests have no password, so their links sign them straight back in. */
export function personalLink(origin: string, slug: string, person: Pick<Person, 'password_hash' | 'access_key'>): string {
  return person.password_hash ? `${origin}/e/${slug}` : `${origin}/k/${person.access_key}?e=${encodeURIComponent(slug)}`;
}

function record(eventId: string, updateId: string | null, personId: string, o: Outcome): Promise<void> {
  return run(
    'INSERT INTO deliveries (event_id, update_id, person_id, channel, destination, status, detail) VALUES (?, ?, ?, ?, ?, ?, ?)',
    eventId,
    updateId,
    personId,
    o.channel,
    o.destination,
    o.status,
    o.detail,
  );
}

export type Audience = 'going' | 'going_maybe' | 'everyone';

export async function postUpdate(event: EventRow, message: string, audience: Audience, origin: string): Promise<DeliverySummary> {
  const updateId = shortId(12);
  await run('INSERT INTO updates (id, event_id, message) VALUES (?, ?, ?)', updateId, event.id, message);

  const statuses = audience === 'going' ? ['going'] : audience === 'going_maybe' ? ['going', 'maybe'] : ['going', 'maybe', 'declined'];
  const recipients = await all<Pick<Person, 'id' | 'phone' | 'email' | 'password_hash' | 'access_key'> & { notify: Notify }>(
    `SELECT p.id, p.phone, p.email, p.password_hash, p.access_key, r.notify
       FROM rsvps r JOIN people p ON p.id = r.person_id
       WHERE r.event_id = ? AND r.person_id != ? AND r.status IN (${statuses.map(() => '?').join(',')})`,
    event.id,
    event.host_id,
    ...statuses,
  );

  const summary: DeliverySummary = { sent: 0, logged: 0, failed: 0, skipped: 0, total: recipients.length };
  for (const r of recipients) {
    const link = personalLink(origin, event.slug, r);
    const body = `Update for ${event.title}: ${message}\n\nEvent page: ${link}`;
    const outcome = await sendTo(r, r.notify, `Update: ${event.title}`, body);
    await record(event.id, updateId, r.id, outcome);
    summary[outcome.status]++;
  }
  return summary;
}

export async function sendRsvpConfirmation(event: EventRow, person: Person, status: string, notify: Notify, origin: string): Promise<void> {
  if (notify === 'none') return;
  const when = formatWhen(event.starts_at, event.ends_at, event.timezone);
  const word = status === 'going' ? "You're going to" : status === 'maybe' ? "You're a maybe for" : "You've declined";
  const body =
    `${word} ${event.title} on ${when.date}, ${when.time}. ` +
    `We'll send event updates here. See details or change your RSVP: ${personalLink(origin, event.slug, person)}`;
  await record(event.id, null, person.id, await sendTo(person, notify, `RSVP: ${event.title}`, body));
}
