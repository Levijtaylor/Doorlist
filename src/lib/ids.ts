import { randomBytes } from 'node:crypto';

// 32 symbols, no look-alikes (0/o, 1/l). 256 % 32 === 0, so no modulo bias.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

export function shortId(length = 12): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function secretToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 40)
    .replace(/-+$/, '');
  return (base ? `${base}-` : '') + shortId(6);
}
