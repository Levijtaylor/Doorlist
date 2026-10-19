import Link from 'next/link';
import { currentPerson } from '@/lib/auth';
import LogoutButton from './LogoutButton';

export default async function Header() {
  const me = await currentPerson();
  return (
    <header className="site-header">
      <div className="container header-row">
        <Link href="/" className="logo">
          Gather<span>.</span>
        </Link>
        <nav>
          {me?.password_hash ? (
            <>
              <Link href="/dashboard">My events</Link>
              <LogoutButton />
              <Link href="/events/new" className="btn btn-primary btn-sm">
                New event
              </Link>
            </>
          ) : me ? (
            <>
              <span className="muted small hide-sm">Hi, {me.first_name}</span>
              <Link href="/signup">Save my account</Link>
              <LogoutButton label="Not you?" />
            </>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/signup" className="btn btn-primary btn-sm">
                Host an event
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
