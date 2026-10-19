'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton({ label = 'Log out' }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
