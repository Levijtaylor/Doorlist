// Event times are stored as the host's wall-clock time ("2026-11-07T18:00") plus an IANA time zone.

function parts(local: string): [number, number, number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) throw new Error(`Invalid date-time: ${local}`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
}

/** The wall-clock value as a UTC Date, for formatting with timeZone: 'UTC'. */
function wallClock(local: string): Date {
  const [y, mo, d, h, mi] = parts(local);
  return new Date(Date.UTC(y, mo - 1, d, h, mi));
}

function offsetAt(ms: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** The real instant for a wall-clock time in a time zone. */
export function zonedToUtc(local: string, timeZone: string): Date {
  const guess = wallClock(local).getTime();
  const first = offsetAt(guess, timeZone);
  let t = guess - first;
  const second = offsetAt(t, timeZone);
  if (second !== first) t = guess - second;
  return new Date(t);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const longDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const clock = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

function tzName(local: string, timeZone: string): string {
  try {
    const instant = zonedToUtc(local, timeZone);
    return new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(instant).find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

export function formatWhen(start: string, end: string | null, timeZone: string) {
  const s = wallClock(start);
  const zone = tzName(start, timeZone);
  let time = clock.format(s);
  if (end) {
    const e = wallClock(end);
    const sameDay = start.slice(0, 10) === end.slice(0, 10);
    time += sameDay ? ` – ${clock.format(e)}` : ` – ${shortDate.format(e)}, ${clock.format(e)}`;
  }
  return {
    date: longDate.format(s),
    time: zone ? `${time} ${zone}` : time,
    short: `${shortDate.format(s)} · ${clock.format(s)}`,
  };
}

export function formatDeadline(local: string): string {
  const d = wallClock(local);
  return `${shortDate.format(d)}, ${clock.format(d)}`;
}

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function shortName(first: string, last: string): string {
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

export function timeAgo(sqliteUtc: string): string {
  const then = new Date(sqliteUtc.replace(' ', 'T') + 'Z').getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
