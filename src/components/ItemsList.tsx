'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import type { ItemView } from '@/lib/events';

const short = (first: string, last: string) => (last ? `${first} ${last[0]}.` : first);

export default function ItemsList({ eventId, items, myId, canClaim }: { eventId: string; items: ItemView[]; myId: string | null; canClaim: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function claim(itemId: string, quantity: number) {
    setBusy(itemId);
    setError('');
    const res = await api(`/api/events/${eventId}/items/${itemId}/claim`, { quantity });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="items">
      {items.map((it) => {
        const mine = it.claims.find((c) => c.person_id === myId)?.quantity ?? 0;
        const left = it.quantity - it.claimed;
        const others = it.claims.filter((c) => c.person_id !== myId);
        return (
          <div key={it.id} className={`item${left <= 0 && !mine ? ' done' : ''}`}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>
                {it.name}
                {it.quantity > 1 && <span className="muted"> · {it.quantity} needed</span>}
              </div>
              <div className="meta">
                {it.note && <>{it.note} · </>}
                {left <= 0 ? 'Covered' : `${left} still needed`}
                {others.length > 0 && <> · {others.map((c) => short(c.first_name, c.last_name) + (c.quantity > 1 ? ` (${c.quantity})` : '')).join(', ')}</>}
              </div>
            </div>
            <div>
              {canClaim &&
                (mine > 0 ? (
                  it.quantity > 1 ? (
                    <div className="stepper" aria-label={`How many ${it.name} you’re bringing`}>
                      <button type="button" aria-label="Bring fewer" disabled={busy === it.id} onClick={() => claim(it.id, mine - 1)}>
                        −
                      </button>
                      <output>{mine}</output>
                      <button type="button" aria-label="Bring more" disabled={busy === it.id || left <= 0} onClick={() => claim(it.id, mine + 1)}>
                        +
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-sm" disabled={busy === it.id} onClick={() => claim(it.id, 0)}>
                      ✓ You’re bringing it
                    </button>
                  )
                ) : left > 0 ? (
                  <button type="button" className="btn btn-sm btn-primary" disabled={busy === it.id} onClick={() => claim(it.id, 1)}>
                    I’ll bring {it.quantity > 1 ? 'one' : 'it'}
                  </button>
                ) : null)}
            </div>
          </div>
        );
      })}
      {!canClaim && <p className="muted small">RSVP going or maybe to sign up for something.</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
