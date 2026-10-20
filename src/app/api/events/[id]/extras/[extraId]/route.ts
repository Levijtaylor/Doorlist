import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { currentPerson } from '@/lib/auth';
import { fail } from '@/lib/api';
import { getEvent } from '@/lib/events';

/** The guest who added it, or the host, can remove an extra. */
export async function DELETE(_req: Request, { params }: { params: { id: string; extraId: string } }) {
  const [me, event] = await Promise.all([currentPerson(), getEvent(params.id)]);
  if (!event) return fail('That event no longer exists.', 404);
  if (!me) return fail('Log in to make changes.', 401);

  const extra = await get<{ person_id: string }>('SELECT person_id FROM guest_extras WHERE id = ? AND event_id = ?', params.extraId, event.id);
  if (!extra) return NextResponse.json({ ok: true });
  if (extra.person_id !== me.id && event.host_id !== me.id) return fail('You can only remove things you added.', 403);

  await run('DELETE FROM guest_extras WHERE id = ?', params.extraId);
  return NextResponse.json({ ok: true });
}
