import { getEvent } from '@/lib/events';
import { zonedToUtc } from '@/lib/format';
import { appOrigin } from '@/lib/origin';

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);

/** "Add to calendar": a single-event .ics file that works with Apple, Google and Outlook calendars. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const e = getEvent(params.id);
  if (!e) return new Response('Not found', { status: 404 });

  const start = zonedToUtc(e.starts_at, e.timezone);
  const end = e.ends_at ? zonedToUtc(e.ends_at, e.timezone) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const url = `${appOrigin()}/e/${e.slug}`;
  const location = [e.location_name, e.location_address].filter(Boolean).join(', ') || e.online_url;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gather//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@gather`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc([e.description, `RSVP and details: ${url}`].filter(Boolean).join('\n\n'))}`,
    location ? `LOCATION:${esc(location)}` : '',
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${e.slug}.ics"`,
    },
  });
}
