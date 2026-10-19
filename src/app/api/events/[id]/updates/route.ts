import { NextResponse } from 'next/server';
import { currentPerson } from '@/lib/auth';
import { fail, parseBody } from '@/lib/api';
import { updateSchema } from '@/lib/schemas';
import { getEvent } from '@/lib/events';
import { postUpdate } from '@/lib/notify';
import { appOrigin } from '@/lib/origin';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const [me, event] = await Promise.all([currentPerson(), getEvent(params.id)]);
  if (!event) return fail('That event no longer exists.', 404);
  if (!me || me.id !== event.host_id) return fail('Only the host can send updates.', 403);

  const { data, error } = await parseBody(req, updateSchema);
  if (error) return error;

  const delivery = await postUpdate(event, data.message, data.audience, appOrigin());
  return NextResponse.json({ ok: true, delivery });
}
