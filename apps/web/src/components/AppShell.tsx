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

const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/admin',
  STAFF: '/staff',
  MEMBER: '/member',
};

function isNavActive(pathname: string, href: string, roleHome: string) {
  if (href === roleHome) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ) : (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-800/70">
        Loading…
      </div>
    );
  }

  const items = NAV[role];
  const roleHome = ROLE_HOME[role];

  async function onLogout() {
    await logout();
    router.push('/login');
  }

  const brand = (
    <div className="flex items-center gap-3">
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt=""
          className="h-10 w-10 shrink-0 rounded-md bg-white/10 object-cover"
        />
      ) : null}
      <div className="min-w-0">
        <p className="truncate font-display text-xl font-bold tracking-tight">
          {settings.companyName}
        </p>
        <p className="truncate text-xs uppercase tracking-[0.18em] text-moss-400">
          {user.role.toLowerCase()} · {user.name || user.email}
        </p>
      </div>
    </div>
  );

  const navLinks = (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
      {items.map((item) => {
        const active = isNavActive(pathname, item.href, roleHome);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition',
              active
                ? 'bg-moss-600 text-white'
                : 'text-sand-100/80 hover:bg-white/10 hover:text-white',
            )}
          >
            <span>{item.label}</span>
            {item.label === 'Alerts' && unread > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ember-500 px-1 text-[11px] font-bold text-white">
                {unread}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const logoutButton = (
    <button
      type="button"
      className="rounded-md px-3 py-2.5 text-left text-sm font-medium text-sand-100/80 transition hover:bg-white/10 hover:text-white"
      onClick={onLogout}
    >
      Log out
    </button>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink-800/10 bg-ink-950/95 px-4 py-3 text-sand-50 backdrop-blur md:hidden">
        <div className="min-w-0 flex-1">{brand}</div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-white/10"
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          <MenuIcon open={sidebarOpen} />
        </button>
      </header>

      {/* Mobile backdrop */}
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink-950/50 md:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* Sidebar / drawer */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-ink-950 text-sand-50 transition-transform duration-200 ease-out md:static md:z-0 md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="hidden border-b border-white/10 px-4 py-5 md:block">{brand}</div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
          {navLinks}
          {logoutButton}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </main>
    </div>
  );
}
