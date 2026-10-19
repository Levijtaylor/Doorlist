import { createClient, type Client, type InStatement, type InValue } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';

// Child rows are removed explicitly in code (see deleteEvent, syncItems), so behavior
// doesn't depend on whether the server enforces foreign keys.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT COLLATE NOCASE,
  phone TEXT,
  password_hash TEXT,
  access_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Only real accounts (with a password) must have a unique email; guests may reuse one.
CREATE UNIQUE INDEX IF NOT EXISTS people_account_email ON people(email) WHERE password_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  host_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  banner_preset TEXT NOT NULL DEFAULT 'citrus',
  banner_image TEXT,
  accent TEXT NOT NULL DEFAULT 'ember',
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  timezone TEXT NOT NULL,
  location_name TEXT NOT NULL DEFAULT '',
  location_address TEXT NOT NULL DEFAULT '',
  online_url TEXT NOT NULL DEFAULT '',
  has_fee INTEGER NOT NULL DEFAULT 0,
  fee_cents INTEGER NOT NULL DEFAULT 0,
  fee_currency TEXT NOT NULL DEFAULT 'USD',
  fee_note TEXT NOT NULL DEFAULT '',
  bring_note TEXT NOT NULL DEFAULT '',
  dress_code TEXT NOT NULL DEFAULT '',
  capacity INTEGER,
  max_plus_ones INTEGER NOT NULL DEFAULT 0,
  rsvp_deadline TEXT,
  allow_maybe INTEGER NOT NULL DEFAULT 1,
  show_guest_list INTEGER NOT NULL DEFAULT 1,
  invite_only INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS events_host ON events(host_id);

CREATE TABLE IF NOT EXISTS invitees (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL UNIQUE,
  person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('going', 'maybe', 'declined')),
  plus_ones INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'link',
  notify TEXT NOT NULL DEFAULT 'none',
  invitee_id TEXT REFERENCES invitees(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, person_id)
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS item_claims (
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (item_id, person_id)
);

CREATE TABLE IF NOT EXISTS updates (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  update_id TEXT REFERENCES updates(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

declare global {
  // Reuse one client across hot reloads in development.
  // eslint-disable-next-line no-var
  var __doorlistDb: { client: Client; ready: Promise<void> } | undefined;
}

/** Turso in production (TURSO_DATABASE_URL), a local SQLite file otherwise. */
function open() {
  let url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'doorlist.db');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    url = `file:${file.replace(/\\/g, '/')}`;
  }
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return { client, ready: client.executeMultiple(SCHEMA) };
}

async function db(): Promise<Client> {
  const conn = (globalThis.__doorlistDb ??= open());
  await conn.ready;
  return conn.client;
}

type Row = Record<string, unknown>;

export async function all<T = Row>(sql: string, ...args: InValue[]): Promise<T[]> {
  const rs = await (await db()).execute({ sql, args });
  return rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])) as T);
}

export async function get<T = Row>(sql: string, ...args: InValue[]): Promise<T | null> {
  return (await all<T>(sql, ...args))[0] ?? null;
}

export async function run(sql: string, ...args: InValue[]): Promise<void> {
  await (await db()).execute({ sql, args });
}

export const stmt = (sql: string, ...args: InValue[]): InStatement => ({ sql, args });

/** Runs the statements atomically: all apply or none do. */
export async function batch(statements: InStatement[]): Promise<void> {
  if (statements.length) await (await db()).batch(statements, 'write');
}
