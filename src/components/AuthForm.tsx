'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';

type Props = {
  mode: 'login' | 'signup';
  next: string;
  prefill?: { firstName: string; lastName: string; phone: string };
};

export default function AuthForm({ mode, next, prefill }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: prefill?.firstName ?? '', lastName: prefill?.lastName ?? '', email: '', password: '', phone: prefill?.phone ?? '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = mode === 'signup' ? await api('/api/auth/signup', form) : await api('/api/auth/login', { email: form.email, password: form.password });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.push(next);
    router.refresh();
  }

  const other = mode === 'signup' ? '/login' : '/signup';
  return (
    <form className="panel stack" onSubmit={submit} noValidate>
      {mode === 'signup' && (
        <div className="grid-2">
          <label className="field">
            <span>First name</span>
            <input id="firstName" type="text" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} required />
          </label>
          <label className="field">
            <span>Last name</span>
            <input id="lastName" type="text" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} required />
          </label>
        </div>
      )}
      <label className="field">
        <span>Email</span>
        <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
      </label>
      <label className="field">
        <span>Password {mode === 'signup' && <span className="hint">· at least 8 characters</span>}</span>
        <input id="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} required />
      </label>
      {mode === 'signup' && (
        <label className="field">
          <span>
            Mobile number <span className="hint">· optional, for event updates by text</span>
          </span>
          <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
        </label>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Log in'}
      </button>
      <p className="muted small">
        {mode === 'signup' ? 'Already have an account? ' : 'New here? '}
        <Link href={`${other}?next=${encodeURIComponent(next)}`}>{mode === 'signup' ? 'Log in' : 'Create an account'}</Link>
      </p>
    </form>
  );
}
