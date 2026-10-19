import EventForm, { type EventFormValues } from '@/components/EventForm';
import { requireAccount } from '@/lib/auth';

export const metadata = { title: 'New event' };

const blank: EventFormValues = {
  title: '',
  description: '',
  bannerPreset: 'citrus',
  accent: 'ember',
  startsAt: '',
  endsAt: '',
  timezone: '',
  locationName: '',
  locationAddress: '',
  onlineUrl: '',
  hasFee: false,
  feeAmount: '',
  feeCurrency: 'USD',
  feeNote: '',
  bringNote: '',
  dressCode: '',
  capacity: '',
  maxPlusOnes: '1',
  rsvpDeadline: '',
  allowMaybe: true,
  showGuestList: true,
  inviteOnly: false,
  items: [],
  invitees: [],
};

export default async function NewEventPage() {
  await requireAccount('/events/new');
  return (
    <div className="container page" style={{ maxWidth: 820 }}>
      <div className="stack">
        <p className="eyebrow">New event</p>
        <h1>Set it up once, share it anywhere</h1>
      </div>
      <EventForm mode="create" initial={blank} existingBannerUrl={null} />
    </div>
  );
}
