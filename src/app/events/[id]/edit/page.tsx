import { notFound } from 'next/navigation';
import EventForm, { type EventFormValues } from '@/components/EventForm';
import { bannerSrc } from '@/components/Banner';
import { requireAccount } from '@/lib/auth';
import { eventStats, getEvent, listInvitees } from '@/lib/events';
import { db } from '@/lib/db';

export const metadata = { title: 'Edit event' };

export default function EditEventPage({ params }: { params: { id: string } }) {
  const me = requireAccount(`/events/${params.id}/edit`);
  const e = getEvent(params.id);
  if (!e || e.host_id !== me.id) notFound();

  const items = db.prepare('SELECT id, name, quantity, note FROM items WHERE event_id = ? ORDER BY sort, rowid').all(e.id) as {
    id: string;
    name: string;
    quantity: number;
    note: string;
  }[];
  const stats = eventStats(e.id);

  const initial: EventFormValues = {
    title: e.title,
    description: e.description,
    bannerPreset: e.banner_preset,
    accent: e.accent,
    startsAt: e.starts_at,
    endsAt: e.ends_at ?? '',
    timezone: e.timezone,
    locationName: e.location_name,
    locationAddress: e.location_address,
    onlineUrl: e.online_url,
    hasFee: !!e.has_fee,
    feeAmount: e.has_fee ? (e.fee_cents / 100).toFixed(2) : '',
    feeCurrency: e.fee_currency,
    feeNote: e.fee_note,
    bringNote: e.bring_note,
    dressCode: e.dress_code,
    capacity: e.capacity?.toString() ?? '',
    maxPlusOnes: String(e.max_plus_ones),
    rsvpDeadline: e.rsvp_deadline ?? '',
    allowMaybe: !!e.allow_maybe,
    showGuestList: !!e.show_guest_list,
    inviteOnly: !!e.invite_only,
    items: items.map((it) => ({ key: `i-${it.id}`, ...it })),
    invitees: listInvitees(e.id).map((p) => ({ key: `p-${p.id}`, id: p.id, name: p.name, phone: p.phone, email: p.email })),
  };

  return (
    <div className="container page" style={{ maxWidth: 820 }}>
      <div className="stack">
        <p className="eyebrow">Edit event</p>
        <h1>{e.title}</h1>
      </div>
      <EventForm mode="edit" eventId={e.id} initial={initial} existingBannerUrl={bannerSrc(e)} guestCount={stats.going + stats.maybe} />
    </div>
  );
}
