import { NextResponse } from 'next/server';
import { currentPerson, hasAccount } from '@/lib/auth';
import { fail, parseBody } from '@/lib/api';
import { eventSchema } from '@/lib/schemas';
import { getEvent, saveEvent } from '@/lib/events';

export async function POST(req: Request) {
  const me = currentPerson();
  if (!hasAccount(me)) return fail('Create an account or log in to host an event.', 401);

  const { data, error } = await parseBody(req, eventSchema);
  if (error) return error;

  const id = saveEvent(me.id, data);
  return NextResponse.json({ id, slug: getEvent(id)!.slug });
}
