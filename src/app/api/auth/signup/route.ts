import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createPerson, currentPerson, findAccountByEmail, hashPassword, startSession } from '@/lib/auth';
import { fail, parseBody } from '@/lib/api';
import { signupSchema } from '@/lib/schemas';
import { cleanEmail, cleanPhone } from '@/lib/contact';

export async function POST(req: Request) {
  const { data, error } = await parseBody(req, signupSchema);
  if (error) return error;

  const email = cleanEmail(data.email);
  if (email.error || !email.value) return fail(email.error ?? 'Enter a valid email address.');
  const phone = cleanPhone(data.phone);
  if (phone.error) return fail(phone.error);
  if (findAccountByEmail(email.value)) return fail('An account with that email already exists. Log in instead.', 409);

  const passwordHash = hashPassword(data.password);
  const me = currentPerson();

  // A guest who decides to make an account keeps their RSVPs: upgrade them in place.
  if (me && !me.password_hash) {
    db.prepare('UPDATE people SET first_name = ?, last_name = ?, email = ?, phone = COALESCE(?, phone), password_hash = ? WHERE id = ?').run(
      data.firstName,
      data.lastName,
      email.value,
      phone.value,
      passwordHash,
      me.id,
    );
    return NextResponse.json({ ok: true });
  }

  const person = createPerson({ firstName: data.firstName, lastName: data.lastName, email: email.value, phone: phone.value, passwordHash });
  const res = NextResponse.json({ ok: true });
  startSession(res, req, person.id);
  return res;
}
