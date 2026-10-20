import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { batch, get, run, stmt } from './db';
import { secretToken, shortId } from './ids';

export const SESSION_COOKIE = 'doorlist_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export type Person = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  password_hash: string | null;
  access_key: string;
  created_at: string;
};

export async function currentPerson(): Promise<Person | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return get<Person>('SELECT p.* FROM sessions s JOIN people p ON p.id = s.person_id WHERE s.token = ? AND s.expires_at > ?', token, Date.now());
}

export function hasAccount(p: Person | null): p is Person {
  return !!p?.password_hash;
}

/** For host-only pages: send people without an account to sign up / log in. */
export async function requireAccount(nextPath: string): Promise<Person> {
  const me = await currentPerson();
  if (hasAccount(me)) return me;
  redirect(`${me ? '/signup' : '/login'}?next=${encodeURIComponent(nextPath)}`);
}

export function getPerson(id: string): Promise<Person | null> {
  return get<Person>('SELECT * FROM people WHERE id = ?', id);
}

export function findAccountByEmail(email: string): Promise<Person | null> {
  return get<Person>('SELECT * FROM people WHERE email = ? AND password_hash IS NOT NULL', email);
}

export async function createPerson(input: { firstName: string; lastName: string; email?: string | null; phone?: string | null; passwordHash?: string | null }): Promise<Person> {
  const id = shortId(12);
  await run(
    'INSERT INTO people (id, first_name, last_name, email, phone, password_hash, access_key) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id,
    input.firstName,
    input.lastName,
    input.email ?? null,
    input.phone ?? null,
    input.passwordHash ?? null,
    secretToken(),
  );
  return (await getPerson(id))!;
}

function isHttps(req: Request): boolean {
  return new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
}

export async function startSession(res: NextResponse, req: Request, personId: string): Promise<void> {
  const token = secretToken(32);
  await run('INSERT INTO sessions (token, person_id, expires_at) VALUES (?, ?, ?)', token, personId, Date.now() + MAX_AGE_SECONDS * 1000);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps(req),
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession(res: NextResponse): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await run('DELETE FROM sessions WHERE token = ?', token);
  res.cookies.delete(SESSION_COOKIE);
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

/** When a guest logs in to an existing account, carry their RSVPs and item sign-ups over. */
export async function mergeGuestInto(guestId: string, accountId: string): Promise<void> {
  await batch([
    stmt('UPDATE OR IGNORE rsvps SET person_id = ? WHERE person_id = ?', accountId, guestId),
    stmt('UPDATE OR IGNORE item_claims SET person_id = ? WHERE person_id = ?', accountId, guestId),
    stmt('UPDATE guest_extras SET person_id = ? WHERE person_id = ?', accountId, guestId),
    stmt('UPDATE invitees SET person_id = ? WHERE person_id = ?', accountId, guestId),
    stmt('UPDATE deliveries SET person_id = ? WHERE person_id = ?', accountId, guestId),
    // Rows left behind were duplicates of something the account already had.
    stmt('DELETE FROM rsvps WHERE person_id = ?', guestId),
    stmt('DELETE FROM item_claims WHERE person_id = ?', guestId),
    stmt('DELETE FROM sessions WHERE person_id = ?', guestId),
    stmt('DELETE FROM people WHERE id = ? AND password_hash IS NULL', guestId),
  ]);
}
