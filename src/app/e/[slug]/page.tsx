import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Banner, { bannerSrc } from '@/components/Banner';
import ItemsList from '@/components/ItemsList';
import RsvpPanel from '@/components/RsvpPanel';
import Tracker from '@/components/Tracker';
import { currentPerson, getPerson } from '@/lib/auth';
import { accentFor } from '@/lib/banners';
import { parseSource } from '@/lib/channels';
import { displayPhone } from '@/lib/contact';
import { eventStats, getEventBySlug, getInviteeByToken, getRsvp, isInvitedPerson, listGuests, listItems, listUpdates } from '@/lib/events';
import { formatDeadline, formatMoney, formatWhen, shortName, timeAgo, zonedToUtc } from '@/lib/format';
import { appOrigin } from '@/lib/origin';

type Props = { params: { slug: string }; searchParams: { via?: string; i?: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await getEventBySlug(params.slug);
  if (!e) return { title: 'Event not found' };
  const when = formatWhen(e.starts_at, e.ends_at, e.timezone);
  const description = [`${when.date}, ${when.time}`, e.location_name].filter(Boolean).join(' · ');
  const image = `${appOrigin()}/api/events/${e.id}/og?v=${encodeURIComponent(e.updated_at)}`;
  return {
    title: e.title,
    description,
    openGraph: { title: `You’re invited: ${e.title}`, description, images: [{ url: image, width: 1200, height: 630 }], type: 'website' },
    twitter: { card: 'summary_large_image', title: `You’re invited: ${e.title}`, description, images: [image] },
  };
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

export default async function EventPage({ params, searchParams }: Props) {
  const e = await getEventBySlug(params.slug);
  if (!e) notFound();

  const me = await currentPerson();
  const isHost = me?.id === e.host_id;
  const source = parseSource(searchParams.via);
  const [host, invitee, rsvp, stats, items, updates, allGuests, invitedPerson] = await Promise.all([
    getPerson(e.host_id),
    searchParams.i ? getInviteeByToken(e.id, searchParams.i) : null,
    me ? getRsvp(e.id, me.id) : null,
    eventStats(e.id),
    listItems(e.id),
    listUpdates(e.id),
    e.show_guest_list || isHost ? listGuests(e.id) : [],
    me ? isInvitedPerson(e.id, me.id) : false,
  ]);
  const guests = allGuests.filter((g) => g.status !== 'declined');
  const when = formatWhen(e.starts_at, e.ends_at, e.timezone);
  const accent = accentFor(e.accent);

  const deadlinePassed = !!e.rsvp_deadline && zonedToUtc(e.rsvp_deadline, e.timezone).getTime() < Date.now();
  const full = !!e.capacity && stats.headcount >= e.capacity && rsvp?.status !== 'going';
  const closedReason = isHost ? null : deadlinePassed ? `RSVPs closed on ${formatDeadline(e.rsvp_deadline!)}.` : null;
  const invited = !!invitee || !!rsvp || invitedPerson;
  const blockedReason = isHost
    ? null
    : e.invite_only && !invited
      ? 'This event is invite-only. Open the personal link the host sent you to RSVP.'
      : full && !rsvp
        ? 'This event is full.'
        : null;

  const [inviteFirst, ...inviteRest] = (invitee?.name ?? '').split(' ');
  const qs = new URLSearchParams();
  if (searchParams.i) qs.set('i', searchParams.i);
  if (searchParams.via) qs.set('via', searchParams.via);
  const returnPath = `/e/${e.slug}${qs.size ? `?${qs}` : ''}`;
  const location = [e.location_name, e.location_address].filter(Boolean);

  return (
    <div className="event-page" style={{ ['--ev-light' as string]: accent.light, ['--ev-dark' as string]: accent.dark }}>
      <Banner preset={e.banner_preset} imageSrc={bannerSrc(e)}>
        <div className="container banner-inner">
          <p className="when">
            {when.date} · {when.time}
          </p>
          <h1>{e.title}</h1>
          {host && <p style={{ opacity: 0.9 }}>Hosted by {host.first_name} {host.last_name}</p>}
        </div>
      </Banner>

      <div className="container event-layout">
        <div className="stack" style={{ gap: 24 }}>
          {isHost && (
            <div className="notice spread">
              <span>You’re the host. Guests see this page.</span>
              <Link className="btn btn-sm btn-primary" href={`/events/${e.id}/manage`}>
                Manage event
              </Link>
            </div>
          )}

          <section className="panel">
            <dl className="facts" style={{ margin: 0 }}>
              <div className="fact">
                <dt>When</dt>
                <dd>
                  {when.date}
                  <br />
                  {when.time}
                  <br />
                  <a href={`/api/events/${e.id}/ics`}>Add to calendar</a>
                </dd>
              </div>
              {(location.length > 0 || e.online_url) && (
                <div className="fact">
                  <dt>Where</dt>
                  <dd>
                    {e.location_name && <div style={{ fontWeight: 600 }}>{e.location_name}</div>}
                    {e.location_address && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.join(', '))}`} target="_blank" rel="noopener noreferrer">
                        {e.location_address}
                      </a>
                    )}
                    {e.online_url && (
                      <div>
                        <a href={e.online_url} target="_blank" rel="noopener noreferrer">
                          Join online
                        </a>
                      </div>
                    )}
                  </dd>
                </div>
              )}
              <div className="fact">
                <dt>Cost</dt>
                <dd>
                  {e.has_fee ? (
                    <>
                      <span style={{ fontWeight: 650 }}>{formatMoney(e.fee_cents, e.fee_currency)} per person</span>
                      {e.fee_note && <div className="muted">{e.fee_note}</div>}
                    </>
                  ) : (
                    'Free'
                  )}
                </dd>
              </div>
              {e.dress_code && (
                <div className="fact">
                  <dt>Dress</dt>
                  <dd>{e.dress_code}</dd>
                </div>
              )}
              {e.rsvp_deadline && (
                <div className="fact">
                  <dt>RSVP by</dt>
                  <dd>{formatDeadline(e.rsvp_deadline)}</dd>
                </div>
              )}
              {e.max_plus_ones > 0 && (
                <div className="fact">
                  <dt>Guests</dt>
                  <dd>
                    You can bring up to {e.max_plus_ones} {e.max_plus_ones === 1 ? 'person' : 'people'}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {e.description && (
            <section className="section">
              <h2>About</h2>
              <p className="prose">{e.description}</p>
            </section>
          )}

          {(e.bring_note || items.length > 0) && (
            <section className="section">
              <h2>What to bring</h2>
              {e.bring_note && <p className="prose">{e.bring_note}</p>}
              {items.length > 0 && <ItemsList eventId={e.id} items={items} myId={me?.id ?? null} canClaim={!!rsvp && rsvp.status !== 'declined'} />}
            </section>
          )}

          {updates.length > 0 && (
            <section className="section">
              <h2>Updates from the host</h2>
              {updates.map((u) => (
                <div key={u.id} className="update">
                  <p className="prose">{u.message}</p>
                  <p className="muted small">{timeAgo(u.created_at)}</p>
                </div>
              ))}
            </section>
          )}

          {guests.length > 0 && (
            <section className="section">
              <h2>Who’s coming</h2>
              <div className="guest-list">
                {guests.map((g) => (
                  <span key={g.person_id} className="guest-pill" title={g.status === 'maybe' ? 'Maybe' : 'Going'} style={g.status === 'maybe' ? { opacity: 0.7 } : undefined}>
                    <span className="avatar">{initials(g.first_name, g.last_name)}</span>
                    {shortName(g.first_name, g.last_name)}
                    {g.plus_ones > 0 && <span className="muted">+{g.plus_ones}</span>}
                    {g.status === 'maybe' && <span className="muted small">maybe</span>}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside>
          <RsvpPanel
            eventId={e.id}
            returnPath={returnPath}
            allowMaybe={!!e.allow_maybe}
            maxPlusOnes={e.max_plus_ones}
            closedReason={closedReason}
            blockedReason={blockedReason}
            source={source}
            inviteToken={searchParams.i ?? null}
            me={me ? { firstName: me.first_name, lastName: me.last_name, phone: displayPhone(me.phone), email: me.email ?? '', isAccount: !!me.password_hash } : null}
            prefill={invitee ? { firstName: inviteFirst, lastName: inviteRest.join(' '), phone: invitee.phone, email: invitee.email } : null}
            rsvp={rsvp ? { status: rsvp.status, plusOnes: rsvp.plus_ones, note: rsvp.note, notify: rsvp.notify } : null}
          />
          <div className="panel">
            <Tracker stats={stats} capacity={e.capacity} compact allowMaybe={!!e.allow_maybe} />
          </div>
        </aside>
      </div>
    </div>
  );
}
