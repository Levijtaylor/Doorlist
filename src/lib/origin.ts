import { headers } from 'next/headers';

/** Absolute base URL for links that leave the app (texts, emails, link previews). */
export function appOrigin(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const local = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const proto = h.get('x-forwarded-proto') ?? (local ? 'http' : 'https');
  return `${proto}://${host}`;
}
