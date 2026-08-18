'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/settings';
import { api, Role } from '@/lib/api';
import { MemberPhoto } from '@/components/MemberPhoto';
import clsx from 'clsx';

type NavIcon =
  | 'dashboard'
  | 'members'
  | 'users'
  | 'plans'
  | 'checkin'
  | 'reports'
  | 'alerts'
  | 'settings'
  | 'progress'
  | 'visits'
  | 'account'
  | 'logout';

type NavItem = { href: string; label: string; icon: NavIcon };

const NAV: Record<Role, NavItem[]> = {
  ADMIN: [
    { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
    { href: '/admin/members', label: 'Members', icon: 'members' },
    { href: '/admin/users', label: 'Users', icon: 'users' },
    { href: '/admin/plans', label: 'Plans', icon: 'plans' },
    { href: '/admin/attendance', label: 'Check-in', icon: 'checkin' },
    { href: '/admin/reports', label: 'Reports', icon: 'reports' },
    { href: '/admin/notifications', label: 'Alerts', icon: 'alerts' },
    { href: '/admin/settings', label: 'Settings', icon: 'settings' },
  ],
  STAFF: [
    { href: '/staff', label: 'Dashboard', icon: 'dashboard' },
    { href: '/staff/members', label: 'Members', icon: 'members' },
    { href: '/staff/attendance', label: 'Check-in', icon: 'checkin' },
    { href: '/staff/notifications', label: 'Alerts', icon: 'alerts' },
  ],
  MEMBER: [
    { href: '/member', label: 'Dashboard', icon: 'dashboard' },
    { href: '/member/progress', label: 'Progress', icon: 'progress' },
    { href: '/member/attendance', label: 'Visits', icon: 'visits' },
    { href: '/member/notifications', label: 'Alerts', icon: 'alerts' },
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

const ICON_PATHS: Record<NavIcon, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  members: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  users: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
  plans: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  checkin: (
    <>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </>
  ),
  reports: (
    <>
      <path d="M3 3v18h18" />
      <rect x="7" y="10" width="3" height="8" rx="0.5" />
      <rect x="12" y="6" width="3" height="12" rx="0.5" />
      <rect x="17" y="13" width="3" height="5" rx="0.5" />
    </>
  ),
  alerts: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </>
  ),
  progress: (
    <>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </>
  ),
  visits: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20.662a8 8 0 0 1 10 0" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
};

function Glyph({ name }: { name: NavIcon }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[name]}
    </svg>
  );
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
    <nav className="flex flex-col gap-1" aria-label="Main">
      {items.map((item) => {
        const active = isNavActive(pathname, item.href, roleHome);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition',
              active
                ? 'bg-moss-600 text-white'
                : 'text-sand-100/80 hover:bg-white/10 hover:text-white',
            )}
          >
            <span className="shrink-0 opacity-90">
              <Glyph name={item.icon} />
            </span>
            <span className="min-w-0 flex-1">{item.label}</span>
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

  const accountHref = `${roleHome}/account`;
  const accountActive = pathname === accountHref;

  const accountLink = (
    <Link
      href={accountHref}
      className={clsx(
        'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition',
        accountActive
          ? 'bg-moss-600 text-white'
          : 'text-sand-100/80 hover:bg-white/10 hover:text-white',
      )}
    >
      <span className="shrink-0 opacity-90">
        {user.photoUrl ? (
          <MemberPhoto url={user.photoUrl} name={user.name || user.email} size="sm" />
        ) : (
          <Glyph name="account" />
        )}
      </span>
      <span>Account</span>
    </Link>
  );

  const logoutButton = (
    <button
      type="button"
      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-ember-500 transition hover:bg-ember-500/15 hover:text-ember-500"
      onClick={onLogout}
    >
      <span className="shrink-0">
        <Glyph name="logout" />
      </span>
      <span>Log out</span>
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
          'fixed inset-y-0 left-0 z-50 flex h-dvh w-60 flex-col bg-ink-950 text-sand-50 transition-transform duration-200 ease-out md:sticky md:top-0 md:z-0 md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="hidden shrink-0 border-b border-white/10 px-4 py-5 md:block">{brand}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {navLinks}
        </div>
        <div className="flex shrink-0 flex-col gap-1 border-t border-white/10 px-3 py-4">
          {accountLink}
          {logoutButton}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </main>
    </div>
  );
}
