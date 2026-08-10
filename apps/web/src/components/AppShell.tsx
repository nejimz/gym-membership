'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/settings';
import { api, Role } from '@/lib/api';
import clsx from 'clsx';

type NavItem = { href: string; label: string };

const NAV: Record<Role, NavItem[]> = {
  ADMIN: [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/members', label: 'Members' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/attendance', label: 'Check-in' },
    { href: '/admin/reports', label: 'Reports' },
    { href: '/admin/notifications', label: 'Alerts' },
    { href: '/admin/settings', label: 'Settings' },
  ],
  STAFF: [
    { href: '/staff', label: 'Dashboard' },
    { href: '/staff/members', label: 'Members' },
    { href: '/staff/attendance', label: 'Check-in' },
    { href: '/staff/notifications', label: 'Alerts' },
  ],
  MEMBER: [
    { href: '/member', label: 'Dashboard' },
    { href: '/member/progress', label: 'Progress' },
    { href: '/member/attendance', label: 'Visits' },
    { href: '/member/notifications', label: 'Alerts' },
  ],
};

export function AppShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const { settings, logoSrc } = useSettings();
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== role && !(role === 'ADMIN' && user.role === 'ADMIN')) {
      if (user.role === 'ADMIN' && role === 'ADMIN') return;
      if (user.role !== role) {
        router.replace(
          user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : '/member',
        );
      }
    }
  }, [user, loading, role, router]);

  useEffect(() => {
    if (!user) return;
    api<{ count: number }>('/notifications/unread-count')
      .then((r) => setUnread(r.count))
      .catch(() => setUnread(0));
  }, [user, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-800/70">
        Loading…
      </div>
    );
  }

  const items = NAV[role];

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-800/10 bg-ink-950/95 text-sand-50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt=""
                className="h-10 w-10 rounded-md bg-white/10 object-cover"
              />
            ) : null}
            <div>
              <p className="font-display text-2xl font-bold tracking-tight">
                {settings.companyName}
              </p>
              <p className="text-xs uppercase tracking-[0.18em] text-moss-400">
                {user.role.toLowerCase()} · {user.name || user.email}
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-1" aria-label="Main">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'rounded-md px-3 py-2 text-sm font-medium transition',
                  pathname === item.href
                    ? 'bg-moss-600 text-white'
                    : 'text-sand-100/80 hover:bg-white/10 hover:text-white',
                )}
              >
                {item.label}
                {item.label === 'Alerts' && unread > 0 ? (
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ember-500 px-1 text-[11px] font-bold text-white">
                    {unread}
                  </span>
                ) : null}
              </Link>
            ))}
            <button
              type="button"
              className="btn-ghost ml-2 text-sand-100"
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
            >
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
