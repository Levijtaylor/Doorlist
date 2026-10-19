import { NextResponse } from 'next/server';
import { get } from '@/lib/db';
import { startSession, type Person } from '@/lib/auth';

/** Personal links in texts and emails: sign a guest back in on any device. */
export async function GET(req: Request, { params }: { params: { key: string } }) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('e');
  const target = new URL(slug ? `/e/${encodeURIComponent(slug)}` : '/', url);

  const person = await get<Person>('SELECT * FROM people WHERE access_key = ? AND password_hash IS NULL', params.key);
  const res = NextResponse.redirect(target);
  if (person) await startSession(res, req, person.id);
  return res;
}
