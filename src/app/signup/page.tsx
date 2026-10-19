import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { currentPerson } from '@/lib/auth';
import { safeNext } from '@/lib/nav';

export const metadata = { title: 'Create an account' };

export default function SignupPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams.next);
  const me = currentPerson();
  if (me?.password_hash) redirect(next);
  const guest = me && !me.password_hash;
  return (
    <div className="container page" style={{ maxWidth: 520 }}>
      <div className="stack">
        <h1>{guest ? 'Save your account' : 'Host an event'}</h1>
        <p className="muted">
          {guest
            ? 'Add an email and password to keep your RSVPs and host your own events. Everything you’ve RSVP’d to comes with you.'
            : 'Only hosts need an account. Your guests can RSVP with just their name.'}
        </p>
      </div>
      <AuthForm mode="signup" next={next} prefill={guest ? { firstName: me.first_name, lastName: me.last_name, phone: me.phone ?? '' } : undefined} />
    </div>
  );
}
