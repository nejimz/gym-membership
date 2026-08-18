'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { FlashBanner } from '@/components/Feedback';

type DeskMode = 'member' | 'visitor';

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status: string;
  endDate?: string | null;
  plan?: { name: string } | null;
  user: { email: string };
};

type Visitor = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  visitCount?: number;
  lastVisitAt?: string | null;
};

type Attendance = {
  id: string;
  type: 'MEMBER' | 'VISITOR';
  checkInAt: string;
  checkOutAt?: string | null;
  member?: { id: string; firstName: string; lastName: string } | null;
  visitor?: { id: string; firstName: string; lastName: string } | null;
  hostedByMember?: { id: string; firstName: string; lastName: string } | null;
};

const emptyVisitorForm = {
  firstName: '',
  lastName: '',
  phone: '',
};

const LONG_STAY_MS = 3 * 60 * 60 * 1000;
const STAY_TICK_MS = 30 * 1000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatStayDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 1) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function attendeeName(row: Attendance) {
  const person = row.member ?? row.visitor;
  return person ? `${person.firstName} ${person.lastName}` : 'Unknown';
}

function memberCanCheckIn(member: Member) {
  if (member.status !== 'ACTIVE') return false;
  if (member.endDate && new Date(member.endDate) < new Date()) return false;
  return true;
}

function statusLabel(member: Member) {
  if (member.status === 'ACTIVE' && member.endDate && new Date(member.endDate) < new Date()) {
    return 'EXPIRED';
  }
  return member.status;
}

export function AttendanceDesk() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<DeskMode>('member');
  const [q, setQ] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [today, setToday] = useState<Attendance[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [visitorForm, setVisitorForm] = useState(emptyVisitorForm);
  const [hostQ, setHostQ] = useState('');
  const [hostResults, setHostResults] = useState<Member[]>([]);
  const [host, setHost] = useState<Member | null>(null);
  const [now, setNow] = useState(() => Date.now());

  async function refresh() {
    const t = await api<Attendance[]>('/attendance/today');
    setToday(t);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), STAY_TICK_MS);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setMembers([]);
      setVisitors([]);
      return;
    }
    const handle = window.setTimeout(() => {
      search(query).catch((e) => setError(e instanceof Error ? e.message : 'Search failed'));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [q, mode]);

  useEffect(() => {
    const query = hostQ.trim();
    if (!query) {
      setHostResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      searchHosts(query).catch((e) => setError(e instanceof Error ? e.message : 'Search failed'));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [hostQ]);

  async function search(query = q.trim()) {
    if (!query) return;
    const params = new URLSearchParams({ q: query, page: '1', pageSize: '20' });
    if (mode === 'member') {
      const res = await api<{ data: Member[] } | Member[]>(`/members?${params}`);
      setMembers(Array.isArray(res) ? res : Array.isArray(res.data) ? res.data : []);
      setVisitors([]);
      return;
    }
    const res = await api<{ data: Visitor[] }>(`/visitors?${params}`);
    setVisitors(Array.isArray(res.data) ? res.data : []);
    setMembers([]);
  }

  async function searchHosts(query: string) {
    if (!query.trim()) {
      setHostResults([]);
      return;
    }
    const params = new URLSearchParams({ q: query.trim(), page: '1', pageSize: '8' });
    const res = await api<{ data: Member[] } | Member[]>(`/members?${params}`);
    setHostResults(Array.isArray(res) ? res : Array.isArray(res.data) ? res.data : []);
  }

  function flash(kind: 'ok' | 'err', text: string) {
    if (kind === 'ok') {
      setError('');
      setMessage(text);
    } else {
      setMessage('');
      setError(text);
    }
  }

  async function checkInMember(memberId: string) {
    setBusyId(memberId);
    try {
      await api('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ memberId }),
      });
      flash('ok', 'Member checked in');
      await refresh();
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  async function checkOutBy(body: { memberId?: string; visitorId?: string; attendanceId?: string }) {
    const key = body.attendanceId ?? body.memberId ?? body.visitorId ?? 'out';
    setBusyId(key);
    try {
      await api('/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      flash('ok', 'Checked out');
      await refresh();
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  async function checkInVisitor(payload: {
    visitorId?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) {
    const key = payload.visitorId ?? 'new-visitor';
    setBusyId(key);
    try {
      await api('/attendance/check-in/visitor', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          hostedByMemberId: host?.id,
        }),
      });
      flash('ok', 'Visitor checked in');
      setVisitorForm(emptyVisitorForm);
      await refresh();
      if (q.trim()) await search();
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onEncodeVisitor(e: FormEvent) {
    e.preventDefault();
    await checkInVisitor({
      firstName: visitorForm.firstName.trim(),
      lastName: visitorForm.lastName.trim(),
      phone: visitorForm.phone.trim() || undefined,
    });
  }

  function switchMode(next: DeskMode) {
    setMode(next);
    setQ('');
    setMembers([]);
    setVisitors([]);
    searchRef.current?.focus();
  }

  const stats = useMemo(() => {
    const start = startOfToday();
    return {
      onFloor: today.filter((a) => !a.checkOutAt).length,
      membersToday: today.filter((a) => a.type === 'MEMBER' && new Date(a.checkInAt) >= start).length,
      visitorsToday: today.filter((a) => a.type === 'VISITOR' && new Date(a.checkInAt) >= start).length,
    };
  }, [today]);

  function openForMember(memberId: string) {
    return today.find((a) => a.member?.id === memberId && !a.checkOutAt);
  }

  function openForVisitor(visitorId: string) {
    return today.find((a) => a.visitor?.id === visitorId && !a.checkOutAt);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Front desk check-in</h1>
        <p className="mt-1 text-ink-800/70">Search a member or encode a walk-in visitor, then time in or out.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="On the floor" value={stats.onFloor} />
        <StatCard label="Members today" value={stats.membersToday} />
        <StatCard label="Visitors today" value={stats.visitorsToday} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={mode === 'member' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => switchMode('member')}
        >
          Member
        </button>
        <button
          type="button"
          className={mode === 'visitor' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => switchMode('visitor')}
        >
          Walk-in visitor
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={searchRef}
          className="input max-w-md"
          placeholder={mode === 'member' ? 'Search name, email, phone' : 'Search visitor name or phone'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search().catch((err) => setError(err.message));
          }}
        />
        <button type="button" className="btn-primary" onClick={() => search().catch((e) => setError(e.message))}>
          Search
        </button>
      </div>

      {message ? <FlashBanner kind="success" message={message} onDismiss={() => setMessage('')} /> : null}
      {error ? <FlashBanner kind="error" message={error} onDismiss={() => setError('')} /> : null}

      {mode === 'member' && members.length > 0 ? (
        <ul className="card-panel divide-y divide-ink-800/5">
          {members.map((m) => {
            const open = openForMember(m.id);
            const canIn = memberCanCheckIn(m);
            const status = statusLabel(m);
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">
                    {m.firstName} {m.lastName}
                  </p>
                  <p className="text-sm text-ink-800/60">
                    {m.phone || m.user.email}
                    {m.plan?.name ? ` · ${m.plan.name}` : ''}
                    {m.endDate ? ` · until ${formatDate(m.endDate)}` : ''}
                  </p>
                  <StatusBadge status={status} />
                </div>
                <div className="flex gap-2">
                  {open ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busyId === open.id || busyId === m.id}
                      onClick={() => checkOutBy({ attendanceId: open.id })}
                    >
                      Time out
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!canIn || busyId === m.id}
                      title={!canIn ? 'Membership is not active' : undefined}
                      onClick={() => checkInMember(m.id)}
                    >
                      Time in
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {mode === 'visitor' ? (
        <div className="space-y-4">
          {visitors.length > 0 ? (
            <ul className="card-panel divide-y divide-ink-800/5">
              {visitors.map((v) => {
                const open = openForVisitor(v.id);
                return (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-semibold">
                        {v.firstName} {v.lastName}
                      </p>
                      <p className="text-sm text-ink-800/60">
                        {v.phone || 'No phone'}
                        {typeof v.visitCount === 'number' ? ` · ${v.visitCount} visit${v.visitCount === 1 ? '' : 's'}` : ''}
                        {v.lastVisitAt ? ` · last ${formatDate(v.lastVisitAt)}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {open ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={busyId === open.id || busyId === v.id}
                          onClick={() => checkOutBy({ attendanceId: open.id })}
                        >
                          Time out
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={busyId === v.id}
                          onClick={() => checkInVisitor({ visitorId: v.id })}
                        >
                          Time in
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : q.trim() ? (
            <p className="text-sm text-ink-800/60">No matching visitors. Encode a new walk-in below.</p>
          ) : null}

          <form onSubmit={onEncodeVisitor} className="card-panel grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="font-display text-xl font-semibold">Encode walk-in</h2>
              <p className="mt-1 text-sm text-ink-800/60">New guests are saved so you can find them next visit.</p>
            </div>
            <div>
              <label className="label" htmlFor="visitor-first">
                First name
              </label>
              <input
                id="visitor-first"
                className="input"
                required
                value={visitorForm.firstName}
                onChange={(e) => setVisitorForm({ ...visitorForm, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="visitor-last">
                Last name
              </label>
              <input
                id="visitor-last"
                className="input"
                required
                value={visitorForm.lastName}
                onChange={(e) => setVisitorForm({ ...visitorForm, lastName: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="visitor-phone">
                Phone
              </label>
              <input
                id="visitor-phone"
                className="input"
                value={visitorForm.phone}
                onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })}
                placeholder="Recommended for return visits"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="guest-of">
                Guest of (optional)
              </label>
              {host ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">
                    {host.firstName} {host.lastName}
                  </p>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setHost(null);
                      setHostQ('');
                      setHostResults([]);
                    }}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <>
                  <input
                    id="guest-of"
                    className="input"
                    placeholder="Search member name, email, or phone"
                    value={hostQ}
                    onChange={(e) => setHostQ(e.target.value)}
                  />
                  {hostResults.length > 0 ? (
                    <ul className="mt-2 divide-y divide-ink-800/5 rounded-md border border-ink-800/10 bg-white/80">
                      {hostResults.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-sand-100"
                            onClick={() => {
                              setHost(m);
                              setHostQ('');
                              setHostResults([]);
                            }}
                          >
                            <span>
                              {m.firstName} {m.lastName}
                            </span>
                            <span className="text-ink-800/50">{m.phone || m.user.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary" disabled={busyId === 'new-visitor'}>
                Time in walk-in
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <section className="card-panel">
        <h2 className="font-display text-xl font-semibold">Today on the floor</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {today.map((a) => {
            const open = !a.checkOutAt;
            const elapsedMs = now - new Date(a.checkInAt).getTime();
            const longStay = open && elapsedMs >= LONG_STAY_MS;
            return (
              <li
                key={a.id}
                className={
                  longStay
                    ? 'flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ember-500/10 px-2 py-2'
                    : 'flex flex-wrap items-center justify-between gap-2 border-b border-ink-800/5 pb-2'
                }
              >
                <span>
                  <TypeBadge type={a.type} /> {attendeeName(a)}
                  {a.hostedByMember ? (
                    <span className="text-ink-800/55">
                      {' '}
                      · Guest of {a.hostedByMember.firstName} {a.hostedByMember.lastName}
                    </span>
                  ) : null}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <span>
                    In {formatTime(a.checkInAt)}
                    {a.checkOutAt ? (
                      ` · Out ${formatTime(a.checkOutAt)}`
                    ) : (
                      <>
                        {' · '}
                        <span className={longStay ? 'font-semibold text-ember-500' : undefined}>
                          {formatStayDuration(elapsedMs)}
                        </span>
                      </>
                    )}
                  </span>
                  {open ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busyId === a.id}
                      onClick={() => checkOutBy({ attendanceId: a.id })}
                    >
                      Time out
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
          {!today.length ? <li className="text-ink-800/60">No check-ins yet today.</li> : null}
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-panel">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-800/60">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}

function TypeBadge({ type }: { type: 'MEMBER' | 'VISITOR' }) {
  return (
    <span
      className={
        type === 'MEMBER'
          ? 'mr-1 inline-flex rounded-full bg-moss-500/15 px-2 py-0.5 text-xs font-semibold text-moss-700'
          : 'mr-1 inline-flex rounded-full bg-ember-500/15 px-2 py-0.5 text-xs font-semibold text-ember-500'
      }
    >
      {type === 'MEMBER' ? 'Member' : 'Visitor'}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return (
    <span
      className={
        active
          ? 'mt-1 inline-flex rounded-full bg-moss-500/15 px-2 py-0.5 text-xs font-semibold text-moss-700'
          : 'mt-1 inline-flex rounded-full bg-ember-500/15 px-2 py-0.5 text-xs font-semibold text-ember-500'
      }
    >
      {status}
    </span>
  );
}
