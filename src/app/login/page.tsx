import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { currentPerson } from '@/lib/auth';
import { safeNext } from '@/lib/nav';

export const metadata = { title: 'Log in' };

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams.next);
  if (currentPerson()?.password_hash) redirect(next);
  return (
    <div className="container page" style={{ maxWidth: 480 }}>
      <div className="stack">
        <h1>Welcome back</h1>
        <p className="muted">Log in to manage your events and see who’s coming.</p>
      </div>
      <AuthForm mode="login" next={next} />
    </div>
  );
}
