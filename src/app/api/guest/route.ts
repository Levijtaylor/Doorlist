import { NextResponse } from 'next/server';
import { run } from '@/lib/db';
import { createPerson, currentPerson, startSession } from '@/lib/auth';
import { fail, parseBody } from '@/lib/api';
import { guestSchema } from '@/lib/schemas';
import { cleanEmail, cleanPhone } from '@/lib/contact';

/** Continue as a guest: just a first and last name, plus optional contact details for updates. */
export async function POST(req: Request) {
  const { data, error } = await parseBody(req, guestSchema);
  if (error) return error;

  const phone = cleanPhone(data.phone);
  if (phone.error) return fail(phone.error);
  const email = cleanEmail(data.email);
  if (email.error) return fail(email.error);

  const me = await currentPerson();
  if (me && !me.password_hash) {
    await run(
      'UPDATE people SET first_name = ?, last_name = ?, phone = COALESCE(?, phone), email = COALESCE(?, email) WHERE id = ?',
      data.firstName,
      data.lastName,
      phone.value,
      email.value,
      me.id,
    );
    return NextResponse.json({ ok: true, personId: me.id });
  }
  if (me) return NextResponse.json({ ok: true, personId: me.id });

  const person = await createPerson({ firstName: data.firstName, lastName: data.lastName, phone: phone.value, email: email.value });
  const res = NextResponse.json({ ok: true, personId: person.id });
  await startSession(res, req, person.id);
  return res;
}
