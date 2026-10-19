import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { secretToken, shortId } from './ids';

export const SESSION_COOKIE = 'gather_session';
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

export function currentPerson(): Person | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db
    .prepare('SELECT p.* FROM sessions s JOIN people p ON p.id = s.person_id WHERE s.token = ? AND s.expires_at > ?')
    .get(token, Date.now()) as Person | undefined;
  return row ?? null;
}

export function hasAccount(p: Person | null): p is Person {
  return !!p?.password_hash;
}

/** For host-only pages: send people without an account to sign up / log in. */
export function requireAccount(nextPath: string): Person {
  const me = currentPerson();
  if (hasAccount(me)) return me;
  redirect(`${me ? '/signup' : '/login'}?next=${encodeURIComponent(nextPath)}`);
}

export function getPerson(id: string): Person | null {
  return (db.prepare('SELECT * FROM people WHERE id = ?').get(id) as Person | undefined) ?? null;
}

export function findAccountByEmail(email: string): Person | null {
  return (db.prepare('SELECT * FROM people WHERE email = ? AND password_hash IS NOT NULL').get(email) as Person | undefined) ?? null;
}

export function createPerson(input: { firstName: string; lastName: string; email?: string | null; phone?: string | null; passwordHash?: string | null }): Person {
  const id = shortId(12);
  db.prepare('INSERT INTO people (id, first_name, last_name, email, phone, password_hash, access_key) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id,
    input.firstName,
    input.lastName,
    input.email ?? null,
    input.phone ?? null,
    input.passwordHash ?? null,
    secretToken(),
  );
  return getPerson(id)!;
}

function isHttps(req: Request): boolean {
  return new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
}

export function startSession(res: NextResponse, req: Request, personId: string): void {
  const token = secretToken(32);
  db.prepare('INSERT INTO sessions (token, person_id, expires_at) VALUES (?, ?, ?)').run(token, personId, Date.now() + MAX_AGE_SECONDS * 1000);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps(req),
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function endSession(res: NextResponse): void {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.cookies.delete(SESSION_COOKIE);
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

/** When a guest logs in to an existing account, carry their RSVPs and item sign-ups over. */
export function mergeGuestInto(guestId: string, accountId: string): void {
  db.transaction(() => {
    db.prepare('UPDATE OR IGNORE rsvps SET person_id = ? WHERE person_id = ?').run(accountId, guestId);
    db.prepare('UPDATE OR IGNORE item_claims SET person_id = ? WHERE person_id = ?').run(accountId, guestId);
    db.prepare('UPDATE invitees SET person_id = ? WHERE person_id = ?').run(accountId, guestId);
    db.prepare('UPDATE deliveries SET person_id = ? WHERE person_id = ?').run(accountId, guestId);
    db.prepare('DELETE FROM people WHERE id = ? AND password_hash IS NULL').run(guestId);
  })();
}
