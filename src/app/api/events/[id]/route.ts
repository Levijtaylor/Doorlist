import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentPerson } from '@/lib/auth';
import { fail, parseBody } from '@/lib/api';
import { eventSchema } from '@/lib/schemas';
import { getEvent, saveEvent } from '@/lib/events';
import { postUpdate } from '@/lib/notify';
import { appOrigin } from '@/lib/origin';

type Ctx = { params: { id: string } };

function ownedEvent(id: string) {
  const me = currentPerson();
  const event = getEvent(id);
  if (!event) return { error: fail('That event no longer exists.', 404) };
  if (!me || me.id !== event.host_id) return { error: fail('Only the host can change this event.', 403) };
  return { event, me };
}

export async function PUT(req: Request, { params }: Ctx) {
  const owned = ownedEvent(params.id);
  if (owned.error) return owned.error;

  const { data, error } = await parseBody(req, eventSchema);
  if (error) return error;

  saveEvent(owned.me.id, data, owned.event);
  const delivery = data.notifyMessage ? await postUpdate(getEvent(params.id)!, data.notifyMessage, 'going_maybe', appOrigin()) : null;
  return NextResponse.json({ id: params.id, delivery });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const owned = ownedEvent(params.id);
  if (owned.error) return owned.error;
  db.prepare('DELETE FROM events WHERE id = ?').run(params.id);
  return NextResponse.json({ ok: true });
}
