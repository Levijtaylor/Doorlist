import { NextResponse } from 'next/server';
import { run } from '@/lib/db';
import { currentPerson } from '@/lib/auth';
import { fail, parseBody } from '@/lib/api';
import { inviteNoteSchema } from '@/lib/schemas';
import { getEvent } from '@/lib/events';

/** Saves the host's invite message so it's there on every device. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const [me, event] = await Promise.all([currentPerson(), getEvent(params.id)]);
  if (!event) return fail('That event no longer exists.', 404);
  if (!me || me.id !== event.host_id) return fail('Only the host can change the invite message.', 403);

  const { data, error } = await parseBody(req, inviteNoteSchema);
  if (error) return error;

  // Not an edit to the event itself, so updated_at (and the banner cache key) stay put.
  await run('UPDATE events SET invite_note = ? WHERE id = ?', data.note, event.id);
  return NextResponse.json({ ok: true });
}
