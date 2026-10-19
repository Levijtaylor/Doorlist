'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ACCENTS, BANNER_PRESETS } from '@/lib/banners';
import { api } from '@/lib/client';
import Banner from './Banner';

export type ItemDraft = { key: string; id?: string; name: string; quantity: number; note: string };
export type InviteeDraft = { key: string; id?: string; name: string; phone: string; email: string };

export type EventFormValues = {
  title: string;
  description: string;
  bannerPreset: string;
  accent: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  locationName: string;
  locationAddress: string;
  onlineUrl: string;
  hasFee: boolean;
  feeAmount: string;
  feeCurrency: string;
  feeNote: string;
  bringNote: string;
  dressCode: string;
  capacity: string;
  maxPlusOnes: string;
  rsvpDeadline: string;
  allowMaybe: boolean;
  showGuestList: boolean;
  inviteOnly: boolean;
  items: ItemDraft[];
  invitees: InviteeDraft[];
};

let keySeq = 0;
export const newKey = () => `k${++keySeq}`;

async function resizeImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('unreadable'));
      img.src = url;
    });
    const scale = Math.min(1, 1600 / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function EventForm({
  mode,
  eventId,
  initial,
  existingBannerUrl,
  guestCount = 0,
}: {
  mode: 'create' | 'edit';
  eventId?: string;
  initial: EventFormValues;
  existingBannerUrl: string | null;
  guestCount?: number;
}) {
  const router = useRouter();
  const [v, setV] = useState<EventFormValues>(initial);
  // undefined = keep the current photo, null = remove it, string = new upload
  const [bannerImage, setBannerImage] = useState<string | null | undefined>(undefined);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [zones, setZones] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'create' && !initial.timezone) {
      setV((cur) => ({ ...cur, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }));
    }
    try {
      setZones((Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone'));
    } catch {
      /* older browsers: free-text time zone */
    }
  }, [mode, initial.timezone]);

  const set = <K extends keyof EventFormValues>(k: K, value: EventFormValues[K]) => setV((cur) => ({ ...cur, [k]: value }));
  const text = (k: keyof EventFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);
  const check = (k: 'hasFee' | 'allowMaybe' | 'showGuestList' | 'inviteOnly') => (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.checked);

  const preview = bannerImage === undefined ? existingBannerUrl : bannerImage;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setBannerImage(await resizeImage(file));
      setError('');
    } catch {
      setError('That image couldn’t be read. Try a JPEG or PNG.');
    }
  }

  const updateItem = (key: string, patch: Partial<ItemDraft>) => set('items', v.items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const updateInvitee = (key: string, patch: Partial<InviteeDraft>) => set('invitees', v.invitees.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const payload = {
      title: v.title,
      description: v.description,
      bannerPreset: v.bannerPreset,
      bannerImage,
      accent: v.accent,
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      timezone: v.timezone,
      locationName: v.locationName,
      locationAddress: v.locationAddress,
      onlineUrl: v.onlineUrl,
      hasFee: v.hasFee,
      feeAmount: v.hasFee ? Number(v.feeAmount || 0) : 0,
      feeCurrency: v.feeCurrency.toUpperCase(),
      feeNote: v.feeNote,
      bringNote: v.bringNote,
      dressCode: v.dressCode,
      capacity: v.capacity ? Number(v.capacity) : null,
      maxPlusOnes: Number(v.maxPlusOnes || 0),
      rsvpDeadline: v.rsvpDeadline,
      allowMaybe: v.allowMaybe,
      showGuestList: v.showGuestList,
      inviteOnly: v.inviteOnly,
      items: v.items.filter((i) => i.name.trim()).map(({ key: _k, ...i }) => ({ ...i, quantity: Number(i.quantity) || 1 })),
      invitees: v.invitees.filter((i) => i.name.trim()).map(({ key: _k, ...i }) => i),
      notifyMessage: notifyMessage.trim() || undefined,
    };
    const res = mode === 'create' ? await api<{ id: string }>('/api/events', payload) : await api<{ id: string }>(`/api/events/${eventId}`, payload, 'PUT');
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.push(`/events/${res.data.id}/manage`);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await api(`/api/events/${eventId}`, undefined, 'DELETE');
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="stack" style={{ gap: 22 }}>
      {/* Banner */}
      <section className="panel section">
        <div className="spread">
          <h2>Banner</h2>
          <div className="row">
            <input ref={fileRef} id="bannerFile" type="file" accept="image/*" hidden onChange={onFile} />
            <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
              {preview ? 'Change photo' : 'Upload a photo'}
            </button>
            {preview && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBannerImage(null)}>
                Remove photo
              </button>
            )}
          </div>
        </div>
        <Banner preset={v.bannerPreset} imageSrc={preview} className="banner banner-thumb">
          <div className="banner-inner" style={{ minHeight: 0, height: '100%', padding: 18 }}>
            <h2 style={{ color: '#fff', fontSize: 'clamp(1.3rem, 4vw, 2rem)' }}>{v.title || 'Your event title'}</h2>
          </div>
        </Banner>
        {!preview && (
          <div className="swatches" role="group" aria-label="Banner style" style={{ paddingBottom: 18 }}>
            {Object.entries(BANNER_PRESETS).map(([key, p]) => (
              <button key={key} type="button" className="swatch" aria-pressed={v.bannerPreset === key} aria-label={p.label} style={{ background: p.css }} onClick={() => set('bannerPreset', key)}>
                <span className="swatch-label">{p.label}</span>
              </button>
            ))}
          </div>
        )}
        <div className="field">
          <span>Accent color</span>
          <div className="swatches" role="group" aria-label="Accent color">
            {Object.entries(ACCENTS).map(([key, a]) => (
              <button key={key} type="button" className="swatch round" aria-pressed={v.accent === key} aria-label={a.label} title={a.label} style={{ background: a.light }} onClick={() => set('accent', key)} />
            ))}
          </div>
        </div>
      </section>

      {/* Basics */}
      <section className="panel section">
        <h2>The basics</h2>
        <label className="field">
          <span>Title</span>
          <input id="title" type="text" value={v.title} onChange={text('title')} placeholder="Taco night on the roof" maxLength={120} required />
        </label>
        <label className="field">
          <span>
            Description <span className="hint">· what guests should know</span>
          </span>
          <textarea id="description" value={v.description} onChange={text('description')} rows={4} maxLength={5000} />
        </label>
        <label className="field">
          <span>
            Dress code <span className="hint">· optional</span>
          </span>
          <input id="dressCode" type="text" value={v.dressCode} onChange={text('dressCode')} placeholder="Casual, bring a jacket" maxLength={120} />
        </label>
      </section>

      {/* When */}
      <section className="panel section">
        <h2>When</h2>
        <div className="grid-2">
          <label className="field">
            <span>Starts</span>
            <input id="startsAt" type="datetime-local" value={v.startsAt} onChange={text('startsAt')} required />
          </label>
          <label className="field">
            <span>
              Ends <span className="hint">· optional</span>
            </span>
            <input id="endsAt" type="datetime-local" value={v.endsAt} min={v.startsAt || undefined} onChange={text('endsAt')} />
          </label>
        </div>
        <label className="field">
          <span>Time zone</span>
          <input id="timezone" type="text" list="tz-list" value={v.timezone} onChange={text('timezone')} />
          <datalist id="tz-list">
            {zones.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </label>
      </section>

      {/* Where */}
      <section className="panel section">
        <h2>Where</h2>
        <div className="grid-2">
          <label className="field">
            <span>Place name</span>
            <input id="locationName" type="text" value={v.locationName} onChange={text('locationName')} placeholder="Maya’s place" />
          </label>
          <label className="field">
            <span>Address</span>
            <input id="locationAddress" type="text" value={v.locationAddress} onChange={text('locationAddress')} placeholder="123 Main St, Austin, TX" autoComplete="street-address" />
          </label>
        </div>
        <label className="field">
          <span>
            Video call link <span className="hint">· for online events</span>
          </span>
          <input id="onlineUrl" type="url" value={v.onlineUrl} onChange={text('onlineUrl')} placeholder="https://" />
        </label>
      </section>

      {/* Cost */}
      <section className="panel section">
        <h2>Cost to attend</h2>
        <label className="check">
          <input id="hasFee" type="checkbox" checked={v.hasFee} onChange={check('hasFee')} />
          <span>
            There’s a fee to attend
            <small>Guests see the amount and how to pay. Doorlist doesn’t collect payments.</small>
          </span>
        </label>
        {v.hasFee && (
          <>
            <div className="grid-2">
              <label className="field">
                <span>Amount per person</span>
                <input id="feeAmount" type="number" min="0" step="0.01" inputMode="decimal" value={v.feeAmount} onChange={text('feeAmount')} placeholder="20.00" />
              </label>
              <label className="field">
                <span>Currency</span>
                <select id="feeCurrency" value={v.feeCurrency} onChange={text('feeCurrency')}>
                  {['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'MXN'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>How to pay</span>
              <input id="feeNote" type="text" value={v.feeNote} onChange={text('feeNote')} placeholder="Venmo @maya-r before Friday, or cash at the door" maxLength={300} />
            </label>
          </>
        )}
      </section>

      {/* Bring */}
      <section className="panel section">
        <h2>What to bring</h2>
        <label className="field">
          <span>
            Everyone should bring <span className="hint">· shown to all guests</span>
          </span>
          <textarea id="bringNote" value={v.bringNote} onChange={text('bringNote')} rows={2} placeholder="A lawn chair and your own drinks" maxLength={1000} />
        </label>
        <div className="field">
          <span>
            Sign-up list <span className="hint">· guests pick what they’ll bring</span>
          </span>
          <div className="stack" style={{ gap: 8 }}>
            {v.items.map((it) => (
              <div className="editor-row" key={it.key}>
                <input type="text" aria-label="Item" value={it.name} onChange={(e) => updateItem(it.key, { name: e.target.value })} placeholder="Tortilla chips" maxLength={100} />
                <input type="number" aria-label="How many needed" min={1} max={999} value={it.quantity} onChange={(e) => updateItem(it.key, { quantity: Number(e.target.value) })} />
                <input type="text" aria-label="Note" value={it.note} onChange={(e) => updateItem(it.key, { note: e.target.value })} placeholder="Note (optional)" maxLength={200} />
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${it.name || 'item'}`} onClick={() => set('items', v.items.filter((x) => x.key !== it.key))}>
                  Remove
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn btn-sm" onClick={() => set('items', [...v.items, { key: newKey(), name: '', quantity: 1, note: '' }])}>
                + Add item
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Guests */}
      <section className="panel section">
        <h2>Guests</h2>
        <div className="grid-3">
          <label className="field">
            <span>
              Extra guests each <span className="hint">· plus-ones</span>
            </span>
            <input id="maxPlusOnes" type="number" min={0} max={20} value={v.maxPlusOnes} onChange={text('maxPlusOnes')} />
          </label>
          <label className="field">
            <span>
              Capacity <span className="hint">· blank = no limit</span>
            </span>
            <input id="capacity" type="number" min={1} value={v.capacity} onChange={text('capacity')} />
          </label>
          <label className="field">
            <span>
              RSVP by <span className="hint">· optional</span>
            </span>
            <input id="rsvpDeadline" type="datetime-local" value={v.rsvpDeadline} max={v.startsAt || undefined} onChange={text('rsvpDeadline')} />
          </label>
        </div>
        <label className="check">
          <input id="allowMaybe" type="checkbox" checked={v.allowMaybe} onChange={check('allowMaybe')} />
          <span>Let guests answer “Maybe”</span>
        </label>
        <label className="check">
          <input id="showGuestList" type="checkbox" checked={v.showGuestList} onChange={check('showGuestList')} />
          <span>
            Show the guest list to guests
            <small>Names appear as first name and last initial.</small>
          </span>
        </label>
        <label className="check">
          <input id="inviteOnly" type="checkbox" checked={v.inviteOnly} onChange={check('inviteOnly')} />
          <span>
            Invite-only
            <small>Only people on your list below can RSVP, using their personal link. Anyone else can view the page but can’t RSVP.</small>
          </span>
        </label>
        <hr className="divider" />
        <div className="field">
          <span>
            Who’s invited <span className="hint">· each person gets a personal link so you can see who hasn’t replied</span>
          </span>
          <div className="stack" style={{ gap: 8 }}>
            {v.invitees.map((p) => (
              <div className="editor-row invitee" key={p.key}>
                <input type="text" aria-label="Name" value={p.name} onChange={(e) => updateInvitee(p.key, { name: e.target.value })} placeholder="Name" maxLength={100} />
                <input type="tel" aria-label="Mobile number" value={p.phone} onChange={(e) => updateInvitee(p.key, { phone: e.target.value })} placeholder="Mobile (optional)" />
                <input type="email" aria-label="Email" value={p.email} onChange={(e) => updateInvitee(p.key, { email: e.target.value })} placeholder="Email (optional)" />
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${p.name || 'invitee'}`} onClick={() => set('invitees', v.invitees.filter((x) => x.key !== p.key))}>
                  Remove
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn btn-sm" onClick={() => set('invitees', [...v.invitees, { key: newKey(), name: '', phone: '', email: '' }])}>
                + Add person
              </button>
            </div>
          </div>
        </div>
      </section>

      {mode === 'edit' && guestCount > 0 && (
        <section className="panel section">
          <h2>Tell guests what changed</h2>
          <label className="field">
            <span>
              Message <span className="hint">· optional. Sent to the {guestCount} guest{guestCount === 1 ? '' : 's'} who said going or maybe, using the way each one chose</span>
            </span>
            <textarea id="notifyMessage" value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} rows={2} placeholder="We moved to 7pm. Same place!" maxLength={1000} />
          </label>
        </section>
      )}

      <div className="form-actions">
        <div className="spread">
          <div className="row">
            {mode === 'edit' &&
              (confirmDelete ? (
                <>
                  <span className="small">Delete this event and all RSVPs?</span>
                  <button type="button" className="btn btn-sm btn-danger" onClick={remove} disabled={busy}>
                    Yes, delete
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>
                  Delete event
                </button>
              ))}
          </div>
          <div className="row">
            {error && (
              <span className="error" role="alert">
                {error}
              </span>
            )}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : mode === 'create' ? 'Create event' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
