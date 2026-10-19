import { NextResponse } from 'next/server';
import { currentPerson } from '@/lib/auth';
import { fail, parseBody } from '@/lib/api';
import { eventSchema } from '@/lib/schemas';
import { deleteEvent, getEvent, saveEvent } from '@/lib/events';
import { postUpdate } from '@/lib/notify';
import { appOrigin } from '@/lib/origin';

type Ctx = { params: { id: string } };

async function ownedEvent(id: string) {
  const [me, event] = await Promise.all([currentPerson(), getEvent(id)]);
  if (!event) return { error: fail('That event no longer exists.', 404) };
  if (!me || me.id !== event.host_id) return { error: fail('Only the host can change this event.', 403) };
  return { event, me };
}

export async function PUT(req: Request, { params }: Ctx) {
  const owned = await ownedEvent(params.id);
  if (owned.error) return owned.error;

  const { data, error } = await parseBody(req, eventSchema);
  if (error) return error;

  await saveEvent(owned.me.id, data, owned.event);
  const delivery = data.notifyMessage ? await postUpdate((await getEvent(params.id))!, data.notifyMessage, 'going_maybe', appOrigin()) : null;
  return NextResponse.json({ id: params.id, delivery });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const owned = await ownedEvent(params.id);
  if (owned.error) return owned.error;
  await deleteEvent(params.id);
  return NextResponse.json({ ok: true });
}
