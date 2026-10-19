'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import type { DeliverySummary } from '@/lib/notify';

export function describeDelivery(d: DeliverySummary): string {
  if (!d.total) return 'Posted to the event page. No guests to message yet.';
  const parts = [
    d.sent && `${d.sent} sent`,
    d.logged && `${d.logged} written to the server log (messaging isn’t set up yet)`,
    d.skipped && `${d.skipped} page-only`,
    d.failed && `${d.failed} failed`,
  ].filter(Boolean);
  return `Posted. ${parts.join(' · ')}.`;
}

export default function SendUpdate({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('going_maybe');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult('');
    const res = await api<{ delivery: DeliverySummary }>(`/api/events/${eventId}/updates`, { message, audience });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setResult(describeDelivery(res.data.delivery));
    setMessage('');
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={send}>
      <label className="field">
        <span>Message</span>
        <textarea id="update-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} placeholder="Parking is on the street behind the building." />
      </label>
      <div className="row">
        <label className="field" style={{ flex: '1 1 200px' }}>
          <span>Send to</span>
          <select id="update-audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="going">Going</option>
            <option value="going_maybe">Going and maybe</option>
            <option value="everyone">Everyone who replied</option>
          </select>
        </label>
        <button className="btn btn-primary" disabled={busy || !message.trim()} style={{ alignSelf: 'flex-end' }}>
          {busy ? 'Sending…' : 'Send update'}
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {result && <p className="notice" role="status">{result}</p>}
    </form>
  );
}
