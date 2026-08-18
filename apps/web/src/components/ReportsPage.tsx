'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { AttendanceBarChart, LabeledBarChart, LineMetricChart } from '@/components/Charts';
import { api, downloadApiFile } from '@/lib/api';
import { useSettings } from '@/lib/settings';

const RANGES = [7, 30, 90] as const;

type DayCount = { date: string; count: number };

type PlanMixRow = {
  planId: string | null;
  planName: string;
  count: number;
  contractedValue: number;
};

type ReportMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  planName: string | null;
  endDate: string | null;
  lastVisitAt: string | null;
};

type MembershipSummary = {
  days: number;
  planMix: PlanMixRow[];
  newMembers: DayCount[];
  expiring: ReportMember[];
  expired: ReportMember[];
};

type PeakHours = {
  days: number;
  byHour: { hour: number; label: string; count: number }[];
  byWeekday: { weekday: number; label: string; count: number }[];
  avgSessionMinutes: number | null;
  closedSessions: number;
};

type InactiveMembers = {
  days: number;
  members: ReportMember[];
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function memberName(m: ReportMember) {
  return `${m.firstName} ${m.lastName}`;
}

export function ReportsPage() {
  const { formatMoney } = useSettings();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [attendance, setAttendance] = useState<DayCount[]>([]);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [peak, setPeak] = useState<PeakHours | null>(null);
  const [inactive, setInactive] = useState<InactiveMembers | null>(null);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      api<DayCount[]>(`/reports/attendance-series?days=${days}`),
      api<MembershipSummary>(`/reports/membership-summary?days=${days}`),
      api<PeakHours>(`/reports/peak-hours?days=${days}`),
      api<InactiveMembers>(`/reports/inactive-members?days=${days}`),
    ])
      .then(([series, summary, hours, idle]) => {
        if (cancelled) return;
        setAttendance(series);
        setMembership(summary);
        setPeak(hours);
        setInactive(idle);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load reports');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  async function exportFile(path: string, filename: string) {
    setExportError('');
    try {
      await downloadApiFile(path, filename);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed');
    }
  }

  const planChart = (membership?.planMix ?? []).map((row) => ({
    label: row.planName,
    count: row.count,
  }));
  const newMemberChart = (membership?.newMembers ?? []).map((row) => ({
    label: row.date.slice(5),
    count: row.count,
  }));
  const planValueTotal = (membership?.planMix ?? []).reduce(
    (sum, row) => sum + row.contractedValue,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="mt-1 text-ink-800/70">
            Membership mix, visit patterns, and follow-up lists.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-ink-800/15 bg-white/80 p-0.5">
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                className={clsx(
                  'rounded-md px-3 py-1.5 text-sm font-semibold transition',
                  days === range
                    ? 'bg-moss-600 text-white'
                    : 'text-ink-800/70 hover:bg-sand-100',
                )}
                onClick={() => setDays(range)}
              >
                {range} days
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => exportFile('/reports/members.csv', 'members.csv')}
          >
            Export members
          </button>
        </div>
      </div>

      {error ? <p className="text-ember-500">{error}</p> : null}
      {exportError ? <p className="text-ember-500">{exportError}</p> : null}

      {loading && !membership ? (
        <p className="text-ink-800/70">Loading reports…</p>
      ) : null}

      {!membership ? null : (
      <>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Attendance ({days} days)</h2>
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                exportFile(`/reports/attendance.csv?days=${days}`, 'attendance.csv')
              }
            >
              Export CSV
            </button>
          </div>
          <div className="mt-4">
            <AttendanceBarChart data={attendance} />
          </div>
        </section>

        <section className="card-panel">
          <h2 className="font-display text-xl font-semibold">New members ({days} days)</h2>
          <div className="mt-4">
            <LineMetricChart data={newMemberChart} dataKey="count" name="New members" />
          </div>
        </section>

        <section className="card-panel">
          <h2 className="font-display text-xl font-semibold">Members by plan</h2>
          <p className="mt-1 text-sm text-ink-800/70">
            Current active members
            {planValueTotal
              ? ` · ${formatMoney(planValueTotal)} contracted value`
              : ''}
          </p>
          <div className="mt-4">
            <LabeledBarChart
              data={planChart}
              ariaLabel="Active members by plan"
              name="Members"
            />
          </div>
          {(membership?.planMix.length ?? 0) > 0 ? (
            <ul className="mt-4 space-y-1 text-sm">
              {membership?.planMix.map((row) => (
                <li key={row.planId ?? 'none'} className="flex justify-between gap-3">
                  <span>{row.planName}</span>
                  <span className="font-semibold">
                    {row.count} · {formatMoney(row.contractedValue)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="card-panel">
          <h2 className="font-display text-xl font-semibold">Peak hours ({days} days)</h2>
          <p className="mt-1 text-sm text-ink-800/70">
            Average session {formatDuration(peak?.avgSessionMinutes ?? null)}
            {peak?.closedSessions
              ? ` from ${peak.closedSessions} completed visit${peak.closedSessions === 1 ? '' : 's'}`
              : ''}
          </p>
          <div className="mt-4">
            <LabeledBarChart
              data={peak?.byHour ?? []}
              ariaLabel="Check-ins by hour of day"
              name="Check-ins"
              interval={1}
            />
          </div>
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-ink-800/60">
            By weekday
          </h3>
          <div className="mt-3">
            <LabeledBarChart
              data={peak?.byWeekday ?? []}
              ariaLabel="Check-ins by weekday"
              name="Check-ins"
              color="#c45c26"
            />
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-semibold">
              Expiring within {days} days
            </h2>
            <p className="mt-1 text-sm text-ink-800/70">
              Follow up before memberships lapse.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              exportFile(`/reports/renewals.csv?days=${days}`, 'renewals.csv')
            }
          >
            Export CSV
          </button>
        </div>
        <MemberTable
          rows={membership?.expiring ?? []}
          empty="No memberships expiring in this window."
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Expired / lapsed</h2>
        <MemberTable
          rows={membership?.expired ?? []}
          empty="No expired or lapsed members."
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-semibold">
              Inactive members ({days} days)
            </h2>
            <p className="mt-1 text-sm text-ink-800/70">
              Active members with no check-in in this window, including never visited.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              exportFile(
                `/reports/inactive-members.csv?days=${days}`,
                'inactive-members.csv',
              )
            }
          >
            Export CSV
          </button>
        </div>
        <MemberTable
          rows={inactive?.members ?? []}
          empty="No inactive members in this window."
        />
      </section>
      </>
      )}
    </div>
  );
}

function MemberTable({ rows, empty }: { rows: ReportMember[]; empty: string }) {
  return (
    <div className="max-h-80 overflow-auto rounded-2xl border border-ink-800/10 bg-white/70">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 border-b border-ink-800/10 bg-sand-100/95 text-xs uppercase tracking-wide text-ink-800/60">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Ends</th>
            <th className="px-4 py-3">Last visit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b border-ink-800/5">
              <td className="px-4 py-3 font-medium">
                <Link
                  href={`/admin/members/${m.id}`}
                  className="text-ink-800 hover:text-moss-700"
                >
                  {memberName(m)}
                </Link>
              </td>
              <td className="px-4 py-3">{m.planName ?? '—'}</td>
              <td className="px-4 py-3">{m.status}</td>
              <td className="px-4 py-3">{formatDate(m.endDate)}</td>
              <td className="px-4 py-3">
                {m.lastVisitAt ? formatDate(m.lastVisitAt) : 'Never'}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-ink-800/60" colSpan={5}>
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
