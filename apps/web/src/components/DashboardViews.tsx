'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { AttendanceBarChart, LineMetricChart } from '@/components/Charts';
import { MemberPhoto } from '@/components/MemberPhoto';

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
    photoUrl?: string | null;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
    plan?: { name: string; durationDays: number; price: string | number } | null;
  } | null;
  kpis: {
    visitsThisMonth: number;
    streak: number;
    daysUntilRenewal: number | null;
    checkedIn: boolean;
    openSession: { checkInAt: string } | null;
    avgSessionMinutes: number | null;
  };
  latestMetrics: { weightKg?: number | null; bodyFatPct?: number | null } | null;
  metricSeries: { recordedAt: string; weightKg?: number | null }[];
  attendanceSeries: { date: string; count: number }[];
  recentVisits: { id: string; checkInAt: string; checkOutAt?: string | null }[];
  suggestions: string[];
};

type AlertPreview = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
};

function greetingForHour(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatMinutes(mins: number | null | undefined) {
  if (mins == null || !Number.isFinite(mins)) return '—';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function sessionDurationLabel(checkInAt: string, checkOutAt?: string | null) {
  if (!checkOutAt) return 'Still open';
  const mins = Math.max(
    0,
    Math.round((new Date(checkOutAt).getTime() - new Date(checkInAt).getTime()) / 60_000),
  );
  return formatMinutes(mins);
}

function membershipBadge(status: string, daysUntilRenewal: number | null) {
  if (status === 'SUSPENDED') {
    return { label: 'Suspended', className: 'bg-ink-800/10 text-ink-800/70' };
  }
  if (status === 'EXPIRED' || (daysUntilRenewal != null && daysUntilRenewal < 0)) {
    return { label: 'Expired', className: 'bg-ember-500/15 text-ember-500' };
  }
  if (daysUntilRenewal != null && daysUntilRenewal <= 7) {
    return { label: 'Renews soon', className: 'bg-ember-500/15 text-ember-500' };
  }
  return { label: 'Active', className: 'bg-moss-500/15 text-moss-700' };
}

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
  const { formatMoney } = useSettings();
  const [data, setData] = useState<MemberDash | null>(null);
  const [alerts, setAlerts] = useState<AlertPreview[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  async function loadDashboard() {
    const d = await api<MemberDash>('/reports/dashboard');
    setData(d);
  }

  useEffect(() => {
    Promise.all([
      api<MemberDash>('/reports/dashboard'),
      api<AlertPreview[]>('/notifications').catch(() => [] as AlertPreview[]),
    ])
      .then(([d, notes]) => {
        setData(d);
        setAlerts(notes);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  useEffect(() => {
    if (!data?.kpis.checkedIn) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [data?.kpis.checkedIn]);

  async function toggleCheck() {
    if (!data) return;
    setBusy(true);
    setError('');
    try {
      if (data.kpis.checkedIn) {
        await api('/attendance/check-out', { method: 'POST', body: '{}' });
      } else {
        await api('/attendance/check-in', {
          method: 'POST',
          body: JSON.stringify({ memberId: 'self' }),
        });
      }
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <p className="text-ember-500">{error}</p>;
  if (!data) return <p>Loading…</p>;
  if (!data.member) return <p className="text-ember-500">No member profile found.</p>;

  const fullName = `${data.member.firstName} ${data.member.lastName}`.trim();
  const badge = membershipBadge(data.member.status, data.kpis.daysUntilRenewal);
  const daysLeft = data.kpis.daysUntilRenewal;
  const durationDays = data.member.plan?.durationDays;
  const remainingPct =
    durationDays && daysLeft != null
      ? Math.max(0, Math.min(100, (daysLeft / durationDays) * 100))
      : null;
  const barTone =
    daysLeft != null && daysLeft <= 7 ? 'bg-ember-500' : 'bg-moss-600';
  const checkInAt = data.kpis.openSession?.checkInAt;
  const elapsedMs = checkInAt ? now - new Date(checkInAt).getTime() : 0;
  const attendanceSeries = data.attendanceSeries ?? [];
  const metricSeries = data.metricSeries ?? [];
  const recentVisits = data.recentVisits ?? [];
  const visitTotal = attendanceSeries.reduce((sum, d) => sum + d.count, 0);
  const weightPoints = metricSeries.filter((m) => m.weightKg != null);
  const weightChart = metricSeries.map((m) => ({
    label: new Date(m.recordedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
    weightKg: m.weightKg,
  }));
  const unreadAlerts = alerts.filter((n) => !n.readAt).slice(0, 3);
  const expiring = daysLeft != null && daysLeft <= 7;

  return (
    <div className="space-y-6">
      <section className="card-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <MemberPhoto url={data.member.photoUrl} name={fullName} size="lg" />
            <div className="min-w-0">
              <p className="text-sm text-ink-800/60">{greetingForHour()}</p>
              <h1 className="page-title">{data.member.firstName}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${badge.className}`}
                >
                  {badge.label}
                </span>
                <span className="text-sm text-ink-800/70">
                  {data.member.plan?.name ?? 'No plan'}
                  {data.member.plan
                    ? ` · ${formatMoney(data.member.plan.price)}`
                    : ''}
                </span>
              </div>
            </div>
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

        {daysLeft != null ? (
          <div className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <p className={expiring ? 'font-medium text-ember-500' : 'text-ink-800/70'}>
                {daysLeft < 0
                  ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`
                  : daysLeft === 0
                    ? 'Renews today'
                    : `${daysLeft} day${daysLeft === 1 ? '' : 's'} until renewal`}
              </p>
              {data.member.endDate ? (
                <p className="text-ink-800/55">
                  {new Date(data.member.endDate).toLocaleDateString()}
                </p>
              ) : null}
            </div>
            {remainingPct != null ? (
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-ink-800/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(remainingPct)}
                aria-label="Membership time remaining"
              >
                <div
                  className={`h-full rounded-full ${barTone}`}
                  style={{ width: `${remainingPct}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-800/60">No renewal date on file.</p>
        )}

        {data.kpis.checkedIn ? (
          <div className="mt-4 rounded-lg bg-moss-500/10 px-3 py-2 text-sm font-medium text-moss-700">
            You&apos;re in
            {checkInAt
              ? ` · ${formatElapsed(elapsedMs)} since ${new Date(checkInAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
              : ''}
          </div>
        ) : null}
      </section>

      {error ? <p className="text-sm text-ember-500">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/member/attendance" className="card-panel transition hover:bg-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-800/55">
            Visits this month
          </p>
          <p className="mt-2 font-display text-3xl font-bold">{data.kpis.visitsThisMonth}</p>
          <p className="mt-1 text-xs text-ink-800/55">Aim for 3 visits a week</p>
        </Link>
        <Link href="/member/attendance" className="card-panel transition hover:bg-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-800/55">
            Day streak
          </p>
          <p className="mt-2 font-display text-3xl font-bold">{data.kpis.streak}</p>
          <p className="mt-1 text-xs text-ink-800/55">
            {data.kpis.streak === 1 ? 'Keep it going today' : 'Consecutive visit days'}
          </p>
        </Link>
        <Link href="/member/attendance" className="card-panel transition hover:bg-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-800/55">
            Avg session
          </p>
          <p className="mt-2 font-display text-3xl font-bold">
            {formatMinutes(data.kpis.avgSessionMinutes)}
          </p>
          <p className="mt-1 text-xs text-ink-800/55">From recent check-outs</p>
        </Link>
        <Link href="/member/progress" className="card-panel transition hover:bg-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-800/55">
            Latest weight
          </p>
          <p className="mt-2 font-display text-3xl font-bold">
            {data.latestMetrics?.weightKg ?? '—'}
            {data.latestMetrics?.weightKg != null ? ' kg' : ''}
          </p>
          <p className="mt-1 text-xs text-ink-800/55">
            {data.latestMetrics?.bodyFatPct != null
              ? `${data.latestMetrics.bodyFatPct}% body fat`
              : 'Log a metric on Progress'}
          </p>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-panel">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Visits (14 days)</h2>
            <Link href="/member/attendance" className="text-sm font-medium text-moss-700 hover:underline">
              History
            </Link>
          </div>
          {visitTotal === 0 ? (
            <p className="mt-4 text-sm text-ink-800/70">
              No visits in the last 14 days — check in to start your streak.
            </p>
          ) : (
            <div className="mt-4">
              <AttendanceBarChart
                data={attendanceSeries}
                ariaLabel="Your visits over the last 14 days"
              />
            </div>
          )}
        </section>
        <section className="card-panel">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Weight trend</h2>
            <Link href="/member/progress" className="text-sm font-medium text-moss-700 hover:underline">
              Log metric
            </Link>
          </div>
          {weightPoints.length === 0 ? (
            <p className="mt-4 text-sm text-ink-800/70">
              Log a weight on Progress to see your trend.
            </p>
          ) : (
            <div className="mt-4">
              <LineMetricChart data={weightChart} dataKey="weightKg" name="Weight (kg)" />
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card-panel">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Recent visits</h2>
            <Link href="/member/attendance" className="text-sm font-medium text-moss-700 hover:underline">
              All
            </Link>
          </div>
          {recentVisits.length === 0 ? (
            <p className="mt-4 text-sm text-ink-800/70">No visits yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink-800/8 text-sm">
              {recentVisits.map((v) => (
                <li key={v.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span>
                    {new Date(v.checkInAt).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                    <span className="ml-2 text-ink-800/55">
                      {new Date(v.checkInAt).toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                  <span
                    className={
                      v.checkOutAt ? 'text-ink-800/70' : 'font-medium text-moss-700'
                    }
                  >
                    {sessionDurationLabel(v.checkInAt, v.checkOutAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-panel">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Alerts</h2>
            <Link href="/member/notifications" className="text-sm font-medium text-moss-700 hover:underline">
              Inbox
            </Link>
          </div>
          {unreadAlerts.length === 0 ? (
            <p className="mt-4 text-sm text-ink-800/70">You&apos;re all caught up.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {unreadAlerts.map((n) => (
                <li key={n.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-800/55">
                    {n.type}
                  </p>
                  <p className="mt-0.5 font-medium text-ink-800">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink-800/70">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-panel">
          <h2 className="font-display text-xl font-semibold">Shortcuts</h2>
          <ul className="mt-4 grid gap-2">
            {(
              [
                { href: '/member/progress', label: 'Progress', hint: 'Weight and measurements' },
                { href: '/member/attendance', label: 'Visits', hint: 'Full check-in history' },
                {
                  href: '/member/notifications',
                  label: 'Alerts',
                  hint:
                    unreadAlerts.length > 0
                      ? `${unreadAlerts.length} unread`
                      : 'Renewals and tips',
                },
                { href: '/member/account', label: 'Account', hint: 'Photo and profile' },
              ] as const
            ).map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="-mx-1 flex items-center justify-between gap-3 rounded-md px-1 py-2 text-sm font-medium text-ink-800 transition-colors hover:bg-moss-500/10"
                >
                  <span>{item.label}</span>
                  <span className="font-normal text-ink-800/55">{item.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

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
    </div>
  );
}
