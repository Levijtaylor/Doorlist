import Link from 'next/link';
import Banner, { bannerSrc } from '@/components/Banner';
import { requireAccount } from '@/lib/auth';
import { attendingEvents, hostedEvents } from '@/lib/events';
import { formatWhen } from '@/lib/format';

export const metadata = { title: 'My events' };

const STATUS_LABEL = { going: 'Going', maybe: 'Maybe', declined: 'Can’t go' } as const;

export default async function DashboardPage() {
  const me = await requireAccount('/dashboard');
  const [hosting, attending] = await Promise.all([hostedEvents(me.id), attendingEvents(me.id)]);

  return (
    <div className="container page">
      <div className="spread">
        <div className="stack" style={{ gap: 6 }}>
          <p className="eyebrow">Hi, {me.first_name}</p>
          <h1>My events</h1>
        </div>
        <Link href="/events/new" className="btn btn-primary">
          New event
        </Link>
      </div>

      <section className="section">
        <h2>Hosting</h2>
        {hosting.length === 0 ? (
          <div className="empty">
            <h3>No events yet</h3>
            <p className="muted">Create one, then share the link by text, WhatsApp, Snapchat, Instagram or anywhere else.</p>
            <Link href="/events/new" className="btn btn-primary">
              Create your first event
            </Link>
          </div>
        ) : (
          <div className="cards">
            {hosting.map((e) => {
              const when = formatWhen(e.starts_at, e.ends_at, e.timezone);
              return (
                <article key={e.id} className="card">
                  <Banner preset={e.banner_preset} imageSrc={bannerSrc(e)} className="banner-thumb" />
                  <div className="card-body">
                    <div>
                      <h3>{e.title}</h3>
                      <p className="muted small">{when.short}</p>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="chip going">{e.going} going</span>
                      {e.allow_maybe ? <span className="chip maybe">{e.maybe} maybe</span> : null}
                      <span className="chip declined">{e.declined} can’t</span>
                    </div>
                    <div className="row">
                      <Link className="btn btn-sm btn-primary" href={`/events/${e.id}/manage`}>
                        Manage
                      </Link>
                      <Link className="btn btn-sm" href={`/e/${e.slug}`}>
                        Guest page
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {attending.length > 0 && (
        <section className="section">
          <h2>Invited to</h2>
          <div className="cards">
            {attending.map((e) => (
              <Link key={e.id} href={`/e/${e.slug}`} className="card" style={{ textDecoration: 'none' }}>
                <Banner preset={e.banner_preset} imageSrc={bannerSrc(e)} className="banner-thumb" />
                <div className="card-body">
                  <h3>{e.title}</h3>
                  <p className="muted small">{formatWhen(e.starts_at, e.ends_at, e.timezone).short}</p>
                  <span className={`chip ${e.status}`} style={{ justifySelf: 'start' }}>
                    {STATUS_LABEL[e.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
