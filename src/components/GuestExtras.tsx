'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import type { ExtraView } from '@/lib/events';

const short = (first: string, last: string) => (last ? `${first} ${last[0]}.` : first);

/** "Also bringing": things guests add that aren't on the host's list. */
export default function GuestExtras({ eventId, extras, myId, canAdd }: { eventId: string; extras: ExtraView[]; myId: string | null; canAdd: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    const res = await api(`/api/events/${eventId}/extras`, { name });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setName('');
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    setError('');
    const res = await api(`/api/events/${eventId}/extras/${id}`, undefined, 'DELETE');
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  if (!extras.length && !canAdd) return null;

  return (
    <div className="stack" style={{ gap: 10 }}>
      <h3>Also bringing</h3>
      {extras.length > 0 && (
        <ul className="extras">
          {extras.map((x) => (
            <li key={x.id}>
              <span>
                <strong>{x.name}</strong> <span className="muted">· {x.person_id === myId ? 'you' : short(x.first_name, x.last_name)}</span>
              </span>
              {x.person_id === myId && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => remove(x.id)} aria-label={`Remove ${x.name}`}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canAdd && (
        <form className="linkbox" onSubmit={add}>
          <input
            id="extra-name"
            type="text"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bringing something else? Like “Guacamole” or “Cornhole set”"
            aria-label="Something else you’re bringing"
          />
          <button className="btn btn-sm btn-primary" disabled={busy || !name.trim()}>
            Add
          </button>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
