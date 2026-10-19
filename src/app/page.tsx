import Link from 'next/link';
import Banner from '@/components/Banner';
import { currentPerson } from '@/lib/auth';

export default function Home() {
  const me = currentPerson();
  const host = !!me?.password_hash;

  return (
    <div className="container" style={{ paddingBottom: 72 }}>
      <section className="hero">
        <div>
          <p className="eyebrow">Invites that work in any app</p>
          <h1 style={{ marginTop: 10 }}>Plan it once. Drop one link anywhere. Know who’s coming.</h1>
          <p className="lead">
            Make an event page with your banner, time, cost and a sign-up list for what to bring. Send the link by text, WhatsApp, Snapchat, Instagram or Messenger. Guests RSVP with just their name, no app or account needed.
          </p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link href={host ? '/events/new' : '/signup?next=/events/new'} className="btn btn-primary">
              Create an event
            </Link>
            {host ? (
              <Link href="/dashboard" className="btn">
                My events
              </Link>
            ) : (
              <Link href="/login" className="btn btn-ghost">
                I already have an account
              </Link>
            )}
          </div>
        </div>

        <div className="ticket" aria-label="Example event">
          <Banner preset="confetti" imageSrc={null}>
            <div className="banner-inner">
              <p className="when small">Sat, Nov 14 · 7:00 PM</p>
              <h2 style={{ color: '#fff', fontSize: '1.7rem' }}>Friendsgiving potluck</h2>
            </div>
          </Banner>
          <div className="ticket-body">
            <p className="eyebrow">Example</p>
            <div className="tracker compact">
              <div className="stat going">
                <b>14</b>
                <span>Going</span>
              </div>
              <div className="stat maybe">
                <b>3</b>
                <span>Maybe</span>
              </div>
              <div className="stat declined">
                <b>2</b>
                <span>Can’t go</span>
              </div>
            </div>
            <div className="item">
              <div>
                <div style={{ fontWeight: 650 }}>Pumpkin pie</div>
                <div className="meta">1 still needed · Ana R.</div>
              </div>
              <span className="btn btn-sm btn-primary" aria-hidden="true">
                I’ll bring one
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="panel stack">
          <h3>Only the host signs up</h3>
          <p className="muted">Guests type their first and last name and RSVP. They can save an account later if they want one.</p>
        </div>
        <div className="panel stack">
          <h3>Updates go where they came from</h3>
          <p className="muted">Invited by text or WhatsApp? Updates come back there. From Snapchat or Instagram, guests pick a number or email instead.</p>
        </div>
        <div className="panel stack">
          <h3>A live headcount</h3>
          <p className="muted">See who’s going, who’s a maybe, who can’t make it, who hasn’t replied, and who’s bringing what.</p>
        </div>
      </section>
    </div>
  );
}
