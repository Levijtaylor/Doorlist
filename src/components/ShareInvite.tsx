'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { copyText } from '@/lib/client';
import type { Source } from '@/lib/channels';
import type { InviteeView } from '@/lib/events';

const enc = encodeURIComponent;

const LOOK: Record<Source, { mark: string; bg: string; fg?: string }> = {
  sms: { mark: 'SMS', bg: '#2fa84f' },
  whatsapp: { mark: 'WA', bg: '#1da851' },
  messenger: { mark: 'M', bg: '#0a7cff' },
  snapchat: { mark: 'S', bg: '#fffc00', fg: '#111' },
  instagram: { mark: 'IG', bg: '#d62976' },
  email: { mark: '@', bg: '#5b6472' },
  share: { mark: '↗', bg: '#2b3039' },
  link: { mark: '🔗', bg: '#2b3039' },
};

function Dot({ source }: { source: Source }) {
  const l = LOOK[source];
  return (
    <span className="dot" aria-hidden="true" style={{ background: l.bg, color: l.fg ?? '#fff' }}>
      {l.mark}
    </span>
  );
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function ShareInvite({
  eventId,
  origin,
  slug,
  title,
  when,
  savedNote,
  invitees,
}: {
  eventId: string;
  origin: string;
  slug: string;
  title: string;
  when: string;
  savedNote: string | null;
  invitees: InviteeView[];
}) {
  const defaultNote = `You’re invited to ${title} (${when}). RSVP here:`;
  const [note, setNote] = useState(savedNote ?? defaultNote);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [toast, setToast] = useState('');
  const pending = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  // The message is saved with the event, so it's there on every device and every visit.
  const save = useCallback(
    async (value: string, keepalive = false) => {
      pending.current = null;
      setSaveState('saving');
      try {
        const res = await fetch(`/api/events/${eventId}/invite-note`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: value === defaultNote ? null : value }),
          keepalive,
        });
        setSaveState(res.ok ? 'saved' : 'error');
      } catch {
        setSaveState('error');
      }
    },
    [eventId, defaultNote],
  );

  function flush(keepalive = false) {
    window.clearTimeout(timer.current);
    if (pending.current !== null) void save(pending.current, keepalive);
  }

  function changeNote(value: string) {
    setNote(value);
    pending.current = value;
    setSaveState('idle');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flush(), 700);
  }

  // Leaving the page mid-typing still saves the last edit.
  useEffect(() => {
    const onHide = () => flush(true);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flush(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save]);

  const link = (via: Source, token?: string) => `${origin}/e/${slug}?${token ? `i=${token}&` : ''}via=${via}`;
  const message = (via: Source, token?: string) => [note.trim(), link(via, token)].filter(Boolean).join('\n');

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3200);
  }

  async function copy(url: string, label = 'Link copied.') {
    flash((await copyText(url)) ? label : 'Copy didn’t work here. Long-press the link to copy it.');
  }

  /** Opens the device's share sheet (Snapchat, Instagram, Messenger, AirDrop…), or copies the link where there isn't one. */
  async function share() {
    const url = link('share');
    const text = note.trim();
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(text ? { title, text, url } : { title, url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    await copy(message('share'), 'Message and link copied. Paste them into any chat.');
  }

  return (
    <div className="stack">
      <label className="field">
        <span>
          Your message <span className="hint">· sent with every invite below, followed by the link</span>
        </span>
        <textarea
          id="invite-note"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => changeNote(e.target.value)}
          onBlur={() => flush()}
          placeholder="Add a message, or leave blank to send only the link"
        />
      </label>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="muted small" aria-live="polite">
          {note.trim().length}/500
          {saveState === 'saving' && ' · Saving…'}
          {saveState === 'saved' && ' · Saved'}
          {saveState === 'error' && <span className="error"> · Couldn’t save. Check your connection; it’ll retry when you edit again.</span>}
        </span>
        {note !== defaultNote && (
          <button type="button" className="link-btn small" onClick={() => changeNote(defaultNote)}>
            Reset to default
          </button>
        )}
      </div>
      <div className="invite-preview" aria-label="Preview of what guests receive">
        <span className="eyebrow">Guests will see</span>
        <p className="prose">{message('share')}</p>
      </div>
      <button type="button" className="btn btn-primary btn-block" onClick={share}>
        Share invite…
      </button>
      <p className="muted small">Opens your phone’s share menu so you can send it with Snapchat, Instagram, Messenger or any other app. On a computer, it copies the message and link. A few apps, like Instagram, may keep only the link.</p>
      <div className="share-grid">
        <a className="share-btn" href={`sms:?&body=${enc(message('sms'))}`}>
          <Dot source="sms" /> Text message
        </a>
        <a className="share-btn" href={`https://wa.me/?text=${enc(message('whatsapp'))}`} target="_blank" rel="noopener noreferrer">
          <Dot source="whatsapp" /> WhatsApp
        </a>
        <a className="share-btn" href={`mailto:?subject=${enc(`You’re invited: ${title}`)}&body=${enc(message('email'))}`}>
          <Dot source="email" /> Email
        </a>
      </div>
      <div className="linkbox">
        <input id="share-link" type="text" readOnly value={link('link')} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
        <button type="button" className="btn btn-sm" onClick={() => copy(link('link'))}>
          Copy link
        </button>
        <button type="button" className="btn btn-sm" onClick={() => copy(message('link'), 'Message and link copied.')}>
          Copy message
        </button>
      </div>

      {invitees.length > 0 && (
        <>
          <hr className="divider" />
          <h3>Personal invite links</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Reply</th>
                  <th>Send</th>
                </tr>
              </thead>
              <tbody>
                {invitees.map((p) => {
                  const digits = p.phone.replace(/\D/g, '');
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.status ? <span className={`chip ${p.status}`}>{p.status === 'declined' ? 'Can’t go' : p.status === 'going' ? 'Going' : 'Maybe'}</span> : <span className="chip">No reply</span>}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          {p.phone && (
                            <a className="btn btn-sm" href={`sms:${p.phone}?&body=${enc(message('sms', p.token))}`}>
                              Text
                            </a>
                          )}
                          {digits && (
                            <a className="btn btn-sm" href={`https://wa.me/${digits}?text=${enc(message('whatsapp', p.token))}`} target="_blank" rel="noopener noreferrer">
                              WhatsApp
                            </a>
                          )}
                          {p.email && (
                            <a className="btn btn-sm" href={`mailto:${p.email}?subject=${enc(`You’re invited: ${title}`)}&body=${enc(message('email', p.token))}`}>
                              Email
                            </a>
                          )}
                          <button type="button" className="btn btn-sm" onClick={() => copy(link('link', p.token), `Copied ${p.name}’s link.`)}>
                            Copy link
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
