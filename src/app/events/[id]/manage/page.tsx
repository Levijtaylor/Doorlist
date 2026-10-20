import Link from 'next/link';
import { notFound } from 'next/navigation';
import ShareInvite from '@/components/ShareInvite';
import SendUpdate from '@/components/SendUpdate';
import Tracker from '@/components/Tracker';
import { requireAccount } from '@/lib/auth';
import { eventStats, getEvent, listExtras, listGuests, listInvitees, listItems, listUpdates, sourceBreakdown } from '@/lib/events';
import { NOTIFY_LABEL, SOURCE_LABEL } from '@/lib/channels';
import { displayPhone } from '@/lib/contact';
import { formatWhen, timeAgo } from '@/lib/format';
import { appOrigin } from '@/lib/origin';

export const metadata = { title: 'Manage event' };

const STATUS_LABEL = { going: 'Going', maybe: 'Maybe', declined: 'Can’t go' } as const;

export default async function ManagePage({ params }: { params: { id: string } }) {
  const me = await requireAccount(`/events/${params.id}/manage`);
  const e = await getEvent(params.id);
  if (!e || e.host_id !== me.id) notFound();

  const when = formatWhen(e.starts_at, e.ends_at, e.timezone);
  const [stats, guests, items, updates, sources, invitees] = await Promise.all([
    eventStats(e.id),
    listGuests(e.id),
    listItems(e.id),
    listUpdates(e.id),
    sourceBreakdown(e.id),
    listInvitees(e.id),
  ]);
  const extras = await listExtras(e.id);

  const bringing = new Map<string, string[]>();
  for (const it of items) for (const c of it.claims) bringing.set(c.person_id, [...(bringing.get(c.person_id) ?? []), c.quantity > 1 ? `${it.name} ×${c.quantity}` : it.name]);
  for (const x of extras) bringing.set(x.person_id, [...(bringing.get(x.person_id) ?? []), `${x.name} (their own)`]);

  return (
    <div className="container page">
      <div className="spread">
        <div className="stack" style={{ gap: 6 }}>
          <p className="eyebrow">Manage</p>
          <h1>{e.title}</h1>
          <p className="muted">
            {when.date} · {when.time}
          </p>
        </div>
        <div className="row">
          <Link className="btn" href={`/e/${e.slug}`}>
            View guest page
          </Link>
          <Link className="btn" href={`/events/${e.id}/edit`}>
            Edit event
          </Link>
        </div>
      </div>

      <section className="panel">
        <h2>Who’s coming</h2>
        <Tracker stats={stats} capacity={e.capacity} allowMaybe={!!e.allow_maybe} />
        {sources.length > 0 && (
          <div className="row" style={{ marginTop: 14 }}>
            <span className="muted small">Came from:</span>
            {sources.map((s) => (
              <span key={s.source} className="chip plain">
                {SOURCE_LABEL[s.source]} · {s.count}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="grid-2" style={{ alignItems: 'start', gap: 28 }}>
        <section className="panel">
          <h2>Send invites</h2>
          <ShareInvite eventId={e.id} savedNote={e.invite_note} origin={appOrigin()} slug={e.slug} title={e.title} when={`${when.date}, ${when.time}`} invitees={invitees} />
        </section>
        <section className="panel">
          <h2>Post an update</h2>
          <div className="stack">
            <p className="muted small">Updates appear on the event page and go out by text, WhatsApp or email, using what each guest picked.</p>
            <SendUpdate eventId={e.id} />
            {updates.length > 0 && (
              <>
                <hr className="divider" />
                {updates.map((u) => (
                  <div key={u.id} className="update">
                    <p className="prose">{u.message}</p>
                    <p className="muted small">
                      {timeAgo(u.created_at)}
                      {u.sent ? ` · ${u.sent} sent` : ''}
                      {u.logged ? ` · ${u.logged} logged` : ''}
                      {u.skipped ? ` · ${u.skipped} page-only` : ''}
                      {u.failed ? ` · ${u.failed} failed` : ''}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <h2>Guests</h2>
        {guests.length === 0 ? (
          <p className="muted">No replies yet. Send the invite and RSVPs will show up here.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Reply</th>
                  <th>Extra</th>
                  <th>Came from</th>
                  <th>Updates by</th>
                  <th>Contact</th>
                  <th>Bringing</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => (
                  <tr key={g.person_id}>
                    <td>
                      {g.first_name} {g.last_name}
                      <div className="muted small">{g.is_account ? 'Account' : 'Guest'}</div>
                    </td>
                    <td>
                      <span className={`chip ${g.status}`}>{STATUS_LABEL[g.status]}</span>
                    </td>
                    <td className="num">{g.plus_ones ? `+${g.plus_ones}` : '—'}</td>
                    <td>{SOURCE_LABEL[g.source]}</td>
                    <td>{g.notify === 'none' ? 'Page only' : NOTIFY_LABEL[g.notify]}</td>
                    <td className="small">
                      {displayPhone(g.phone)}
                      {g.phone && g.email ? <br /> : null}
                      {g.email}
                    </td>
                    <td className="small">{bringing.get(g.person_id)?.join(', ') ?? '—'}</td>
                    <td className="small">{g.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(items.length > 0 || extras.length > 0) && (
        <section className="panel">
          <h2>Sign-up list</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Covered</th>
                  <th>Who</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.name}</td>
                    <td className="num">
                      {it.claimed} / {it.quantity}
                    </td>
                    <td className="small">{it.claims.map((c) => `${c.first_name} ${c.last_name}${c.quantity > 1 ? ` (${c.quantity})` : ''}`).join(', ') || '—'}</td>
                  </tr>
                ))}
                {extras.map((x) => (
                  <tr key={x.id}>
                    <td>
                      {x.name} <span className="chip plain">Added by guest</span>
                    </td>
                    <td className="num">—</td>
                    <td className="small">
                      {x.first_name} {x.last_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
