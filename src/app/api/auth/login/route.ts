import { NextResponse } from 'next/server';
import { currentPerson, findAccountByEmail, mergeGuestInto, startSession, verifyPassword } from '@/lib/auth';
import { fail, parseBody } from '@/lib/api';
import { loginSchema } from '@/lib/schemas';

export async function POST(req: Request) {
  const { data, error } = await parseBody(req, loginSchema);
  if (error) return error;

  const account = findAccountByEmail(data.email.toLowerCase());
  if (!account || !verifyPassword(data.password, account.password_hash!)) {
    return fail('That email and password don’t match an account.', 401);
  }

  const me = currentPerson();
  if (me && !me.password_hash && me.id !== account.id) mergeGuestInto(me.id, account.id);

  const res = NextResponse.json({ ok: true });
  startSession(res, req, account.id);
  return res;
}
