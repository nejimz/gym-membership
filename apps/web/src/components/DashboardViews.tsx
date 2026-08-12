'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { AttendanceBarChart } from '@/components/Charts';

type BirthdayRow = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
};

type StaffDash = {
  role: string;
  kpis: {
    activeMembers: number;
    checkInsToday: number;
    renewals7: number;
    renewals30: number;
    openSessions: number;
    birthdaysThisWeek: number;
    revenueSnapshot: number;
  };
  statusMix: { status: string; count: number }[];
  attendanceSeries: { date: string; count: number }[];
  birthdays: BirthdayRow[];
  suggestions: string[];
};

type MemberDash = {
  role: string;
  member: {
    firstName: string;
    lastName: string;
    endDate?: string;
    plan?: { name: string };
  };
  kpis: {
    visitsThisMonth: number;
    streak: number;
    daysUntilRenewal: number | null;
    checkedIn: boolean;
  };
  latestMetrics: { weightKg?: number; bodyFatPct?: number } | null;
  suggestions: string[];
};

function nextBirthdayDate(dateOfBirth: string, now = new Date()) {
  const dob = new Date(dateOfBirth);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = new Date(startOfToday.getFullYear(), dob.getMonth(), dob.getDate());
  if (next < startOfToday) {
    next.setFullYear(startOfToday.getFullYear() + 1);
  }
  return next;
}

function birthdayMeta(dateOfBirth: string, now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = nextBirthdayDate(dateOfBirth, now);
  const days = Math.round(
    (next.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );
  let label: string;
  if (days === 0) label = 'Today';
  else if (days === 1) label = 'Tomorrow';
  else label = next.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  return { label, days };
}

export function StaffDashboardView({ basePath }: { basePath: '/admin' | '/staff' }) {
  const { formatMoney } = useSettings();
  const [data, setData] = useState<StaffDash | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<StaffDash>('/reports/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-ember-500">{error}</p>;
  if (!data) return <p>Loading dashboard…</p>;

  const cards = [
    { label: 'Active members', value: data.kpis.activeMembers },
    { label: 'Check-ins today', value: data.kpis.checkInsToday },
    { label: 'Renewals (7d)', value: data.kpis.renewals7 },
    { label: 'Renewals (30d)', value: data.kpis.renewals30 },
    { label: 'Open sessions', value: data.kpis.openSessions },
    { label: 'Birthdays this week', value: data.kpis.birthdaysThisWeek },
    {
      label: 'Active plan value',
      value: formatMoney(data.kpis.revenueSnapshot),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Operations dashboard</h1>
        <p className="mt-1 text-ink-800/70">Live membership health and floor activity.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card-panel">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-800/55">
              {c.label}
            </p>
            <p className="mt-2 font-display text-3xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-panel">
          <h2 className="font-display text-xl font-semibold">Attendance (14 days)</h2>
          <div className="mt-4">
            <AttendanceBarChart data={data.attendanceSeries} />
          </div>
        </section>
        <section className="card-panel">
          <h2 className="font-display text-xl font-semibold">Suggestions</h2>
          <ul className="mt-4 space-y-3">
            {data.suggestions.map((s) => (
              <li key={s} className="rounded-lg bg-moss-500/10 px-3 py-2 text-sm text-ink-800">
                {s}
              </li>
            ))}
          </ul>
        </section>
        <section className="card-panel">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Birthdays this week</h2>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-800/55">
              {data.birthdays.length} upcoming
            </p>
          </div>
          {data.birthdays.length === 0 ? (
            <p className="mt-4 text-sm text-ink-800/70">No birthdays in the next 7 days</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink-800/8 text-sm">
              {data.birthdays.map((b) => {
                const { label, days } = birthdayMeta(b.dateOfBirth);
                const dateClass =
                  days === 0
                    ? 'text-moss-700 font-semibold'
                    : days === 1
                      ? 'text-ink-800/80'
                      : 'text-ink-800/55';
                return (
                  <li key={b.id}>
                    <Link
                      href={`${basePath}/members/${b.id}`}
                      className={[
                        '-mx-1 flex items-center justify-between gap-4 rounded-md px-1 py-2.5 font-medium text-ink-800 transition-colors hover:bg-moss-500/10',
                        days === 0 ? 'border-l-2 border-moss-600 pl-2' : '',
                      ].join(' ')}
                    >
                      <span>
                        {b.firstName} {b.lastName}
                      </span>
                      <span className={`w-[4.5rem] shrink-0 text-right font-normal ${dateClass}`}>
                        {label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="card-panel">
          <h2 className="font-display text-xl font-semibold">Status mix</h2>
          <ul className="mt-4 space-y-1 text-sm">
            {data.statusMix.map((s) => (
              <li key={s.status} className="flex justify-between">
                <span>{s.status}</span>
                <span className="font-semibold">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function MemberDashboardView() {
  const [data, setData] = useState<MemberDash | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await api<MemberDash>('/reports/dashboard');
    setData(d);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function toggleCheck() {
    if (!data) return;
    setBusy(true);
    try {
      if (data.kpis.checkedIn) {
        await api('/attendance/check-out', { method: 'POST', body: '{}' });
      } else {
        await api('/attendance/check-in', {
          method: 'POST',
          body: JSON.stringify({ memberId: 'self' }),
        });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <p className="text-ember-500">{error}</p>;
  if (!data) return <p>Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">
            Hi, {data.member.firstName}
          </h1>
          <p className="mt-1 text-ink-800/70">
            {data.member.plan?.name ?? 'Member'} ·{' '}
            {data.kpis.daysUntilRenewal != null
              ? `${data.kpis.daysUntilRenewal} days until renewal`
              : 'No end date set'}
          </p>
        </div>
        <button
          type="button"
          className={data.kpis.checkedIn ? 'btn-secondary' : 'btn-primary'}
          disabled={busy}
          onClick={toggleCheck}
        >
          {data.kpis.checkedIn ? 'Check out' : 'Check in'}
        </button>
      </div>
      {error ? <p className="text-sm text-ember-500">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card-panel">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-800/55">
            Visits this month
          </p>
          <p className="mt-2 font-display text-3xl font-bold">{data.kpis.visitsThisMonth}</p>
        </div>
        <div className="card-panel">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-800/55">
            Day streak
          </p>
          <p className="mt-2 font-display text-3xl font-bold">{data.kpis.streak}</p>
        </div>
        <div className="card-panel">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-800/55">
            Latest weight
          </p>
          <p className="mt-2 font-display text-3xl font-bold">
            {data.latestMetrics?.weightKg ?? '—'}
            {data.latestMetrics?.weightKg ? ' kg' : ''}
          </p>
        </div>
      </div>
      <section className="card-panel">
        <h2 className="font-display text-xl font-semibold">Suggestions</h2>
        <ul className="mt-3 space-y-2">
          {data.suggestions.map((s) => (
            <li key={s} className="rounded-lg bg-sand-100 px-3 py-2 text-sm">
              {s}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
