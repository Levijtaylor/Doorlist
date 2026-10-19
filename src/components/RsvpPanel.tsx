'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { NOTIFY, NOTIFY_LABEL, SOURCE_LABEL, cannotMessage, defaultNotify, needsPhone, type Notify, type Source } from '@/lib/channels';

type Status = 'going' | 'maybe' | 'declined';

export type RsvpPanelProps = {
  eventId: string;
  returnPath: string;
  allowMaybe: boolean;
  maxPlusOnes: number;
  closedReason: string | null;
  blockedReason: string | null;
  source: Source;
  inviteToken: string | null;
  me: { firstName: string; lastName: string; phone: string; email: string; isAccount: boolean } | null;
  prefill: { firstName: string; lastName: string; phone: string; email: string } | null;
  rsvp: { status: Status; plusOnes: number; note: string; notify: Notify } | null;
};

const STATUS_TEXT: Record<Status, string> = { going: 'Going', maybe: 'Maybe', declined: 'Can’t go' };
const ANSWER_TEXT: Record<Status, string> = { going: 'You’re going', maybe: 'You said maybe', declined: 'You can’t make it' };

export default function RsvpPanel(p: RsvpPanelProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(!p.rsvp);
  const [status, setStatus] = useState<Status | null>(p.rsvp?.status ?? null);
  const [plusOnes, setPlusOnes] = useState(p.rsvp?.plusOnes ?? 0);
  const [note, setNote] = useState(p.rsvp?.note ?? '');
  const [notify, setNotify] = useState<Notify>(p.rsvp?.notify ?? defaultNotify(p.source));
  const [firstName, setFirstName] = useState(p.prefill?.firstName ?? '');
  const [lastName, setLastName] = useState(p.prefill?.lastName ?? '');
  const [phone, setPhone] = useState(p.me?.phone || p.prefill?.phone || '');
  const [email, setEmail] = useState(p.me?.email || p.prefill?.email || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (p.blockedReason) {
    return (
      <div className="panel stack">
        <h2>RSVP</h2>
        <p className="muted">{p.blockedReason}</p>
      </div>
    );
  }

  if (p.rsvp && !editing) {
    return (
      <div className="panel stack">
        <p className="eyebrow">Your RSVP</p>
        <h2>
          {ANSWER_TEXT[p.rsvp.status]}
          {p.rsvp.plusOnes > 0 && p.rsvp.status !== 'declined' ? ` + ${p.rsvp.plusOnes}` : ''}
        </h2>
        <p className="muted small">
          {p.rsvp.notify === 'none' ? 'You’ll check this page for updates.' : `Updates come to you by ${NOTIFY_LABEL[p.rsvp.notify].toLowerCase()}.`}
        </p>
        {p.closedReason ? (
          <p className="muted small">{p.closedReason}</p>
        ) : (
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            Change RSVP
          </button>
        )}
        {p.me && !p.me.isAccount && (
          <p className="muted small">
            On another device? <Link href={`/signup?next=${encodeURIComponent(p.returnPath)}`}>Save your account</Link> to get back in, or use the link in your confirmation message.
          </p>
        )}
      </div>
    );
  }

  if (p.closedReason) {
    return (
      <div className="panel stack">
        <h2>RSVP</h2>
        <p className="muted">{p.closedReason}</p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!status) return setError('Pick Going, Maybe or Can’t go.');
    setBusy(true);
    setError('');
    if (!p.me) {
      const guest = await api('/api/guest', { firstName, lastName, phone: needsPhone(notify) ? phone : undefined, email: notify === 'email' ? email : undefined });
      if (!guest.ok) {
        setBusy(false);
        return setError(guest.error);
      }
    }
    const res = await api(`/api/events/${p.eventId}/rsvp`, {
      status,
      plusOnes: status === 'declined' ? 0 : plusOnes,
      note,
      notify,
      phone: needsPhone(notify) ? phone : undefined,
      email: notify === 'email' ? email : undefined,
      source: p.source,
      inviteToken: p.inviteToken,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setEditing(false);
    router.refresh();
  }

  const statuses: Status[] = p.allowMaybe ? ['going', 'maybe', 'declined'] : ['going', 'declined'];

  return (
    <form className="panel stack" onSubmit={submit} noValidate>
      <h2>{p.rsvp ? 'Change your RSVP' : 'Are you coming?'}</h2>
      <div className="segmented" role="group" aria-label="Your answer">
        {statuses.map((s) => (
          <button key={s} type="button" className={s} aria-pressed={status === s} onClick={() => setStatus(s)}>
            {STATUS_TEXT[s]}
          </button>
        ))}
      </div>

      {status && status !== 'declined' && p.maxPlusOnes > 0 && (
        <div className="spread">
          <span className="small" style={{ fontWeight: 600 }}>
            Bringing anyone? <span className="muted">(up to {p.maxPlusOnes})</span>
          </span>
          <div className="stepper">
            <button type="button" aria-label="Fewer extra guests" disabled={plusOnes <= 0} onClick={() => setPlusOnes(plusOnes - 1)}>
              −
            </button>
            <output aria-live="polite">+{plusOnes}</output>
            <button type="button" aria-label="More extra guests" disabled={plusOnes >= p.maxPlusOnes} onClick={() => setPlusOnes(plusOnes + 1)}>
              +
            </button>
          </div>
        </div>
      )}

      {!p.me && (
        <>
          <div className="grid-2">
            <label className="field">
              <span>First name</span>
              <input id="rsvp-first" type="text" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="field">
              <span>Last name</span>
              <input id="rsvp-last" type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
          </div>
        </>
      )}

      <label className="field">
        <span>Get event updates by</span>
        <select id="rsvp-notify" value={notify} onChange={(e) => setNotify(e.target.value as Notify)}>
          {NOTIFY.map((n) => (
            <option key={n} value={n}>
              {NOTIFY_LABEL[n]}
            </option>
          ))}
        </select>
        {cannotMessage(p.source) && notify !== 'none' && (
          <span className="hint">{SOURCE_LABEL[p.source]} doesn’t let apps message you, so pick where updates should go.</span>
        )}
      </label>
      {needsPhone(notify) && (
        <label className="field">
          <span>{notify === 'whatsapp' ? 'WhatsApp number' : 'Mobile number'}</span>
          <input id="rsvp-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
        </label>
      )}
      {notify === 'email' && !(p.me?.isAccount && p.me.email) && (
        <label className="field">
          <span>Email</span>
          <input id="rsvp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      )}

      <label className="field">
        <span>
          Note to the host <span className="hint">· optional</span>
        </span>
        <input id="rsvp-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Allergic to peanuts" />
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? 'Sending…' : p.rsvp ? 'Update RSVP' : 'Send RSVP'}
      </button>
      {p.rsvp && (
        <button type="button" className="btn btn-ghost btn-block" onClick={() => setEditing(false)}>
          Cancel
        </button>
      )}
      {!p.me && (
        <p className="muted small">
          No account needed. Want one anyway?{' '}
          <Link href={`/signup?next=${encodeURIComponent(p.returnPath)}`}>Create an account</Link> or <Link href={`/login?next=${encodeURIComponent(p.returnPath)}`}>log in</Link>.
        </p>
      )}
    </form>
  );
}
