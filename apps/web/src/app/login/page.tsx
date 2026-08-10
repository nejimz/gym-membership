'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/settings';

export default function LoginPage() {
  const { login } = useAuth();
  const { settings, logoSrc } = useSettings();
  const router = useRouter();
  const [email, setEmail] = useState('admin@gym.local');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const path = await login(email, password);
      router.push(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            'linear-gradient(120deg, rgba(12,18,16,0.82), rgba(36,51,44,0.55)), url(https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1800&q=80)',
        }}
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-4 py-10 md:flex-row md:items-end md:py-16">
        <div className="max-w-xl text-sand-50 animate-[fadeUp_0.7s_ease]">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt=""
              className="mb-4 h-16 w-16 rounded-xl bg-white/10 object-cover"
            />
          ) : null}
          <p className="font-display text-5xl font-bold leading-none md:text-6xl">
            {settings.companyName}
          </p>
          <p className="mt-4 max-w-md text-lg text-sand-100/85">
            Membership, check-ins, body progress, and renewal alerts in one place.
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="mt-10 w-full max-w-md rounded-2xl border border-white/15 bg-white/95 p-6 shadow-soft backdrop-blur animate-[fadeUp_0.9s_ease] md:mt-0"
        >
          <h1 className="font-display text-2xl font-bold text-ink-900">Sign in</h1>
          <p className="mt-1 text-sm text-ink-800/70">Admin, staff, and members welcome.</p>
          <div className="mt-5 space-y-3">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-ember-500">{error}</p> : null}
          <button type="submit" className="btn-primary mt-5 w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Enter gym desk'}
          </button>
          <p className="mt-4 text-xs text-ink-800/60">
            Demo: admin@gym.local / admin2@gym.local / staff@gym.local / staff2@gym.local —
            password123
          </p>
        </form>
      </div>
      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
