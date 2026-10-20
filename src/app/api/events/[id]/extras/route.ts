import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { currentPerson } from '@/lib/auth';
import { fail, parseBody } from '@/lib/api';
import { extraSchema } from '@/lib/schemas';
import { getEvent, getRsvp } from '@/lib/events';
import { shortId } from '@/lib/ids';

const MAX_PER_GUEST = 10;

/** A guest adds something they're bringing that isn't on the host's list. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const [me, event] = await Promise.all([currentPerson(), getEvent(params.id)]);
  if (!event) return fail('That event no longer exists.', 404);
  if (!me) return fail('RSVP first, then add what you’re bringing.', 401);

  const rsvp = await getRsvp(event.id, me.id);
  if (!rsvp || rsvp.status === 'declined') return fail('RSVP as going or maybe to add what you’re bringing.', 403);

  const { data, error } = await parseBody(req, extraSchema);
  if (error) return error;

  const { n } = (await get<{ n: number }>('SELECT COUNT(*) AS n FROM guest_extras WHERE event_id = ? AND person_id = ?', event.id, me.id))!;
  if (n >= MAX_PER_GUEST) return fail(`You can add up to ${MAX_PER_GUEST} things.`, 409);

  await run('INSERT INTO guest_extras (id, event_id, person_id, name) VALUES (?, ?, ?, ?)', shortId(12), event.id, me.id, data.name);
  return NextResponse.json({ ok: true });
}
