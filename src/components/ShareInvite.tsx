'use client';

import { useState } from 'react';
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

export default function ShareInvite({ origin, slug, title, when, invitees }: { origin: string; slug: string; title: string; when: string; invitees: InviteeView[] }) {
  const [toast, setToast] = useState('');
  const link = (via: Source, token?: string) => `${origin}/e/${slug}?${token ? `i=${token}&` : ''}via=${via}`;
  const message = (via: Source, token?: string) => `You’re invited to ${title} (${when}). RSVP here: ${link(via, token)}`;

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
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: `You’re invited to ${title} (${when}). RSVP here:`, url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    await copy(url, 'Link copied. Paste it into any chat.');
  }

  return (
    <div className="stack">
      <button type="button" className="btn btn-primary btn-block" onClick={share}>
        Share invite…
      </button>
      <p className="muted small">Opens your phone’s share menu so you can send it with Snapchat, Instagram, Messenger or any other app. On a computer, it copies the link.</p>
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
          Copy
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
