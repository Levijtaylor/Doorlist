import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { startSession, type Person } from '@/lib/auth';

/** Personal links in texts and emails: sign a guest back in on any device. */
export async function GET(req: Request, { params }: { params: { key: string } }) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('e');
  const target = new URL(slug ? `/e/${encodeURIComponent(slug)}` : '/', url);

  const person = db.prepare('SELECT * FROM people WHERE access_key = ? AND password_hash IS NULL').get(params.key) as Person | undefined;
  const res = NextResponse.redirect(target);
  if (person) startSession(res, req, person.id);
  return res;
}
