'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  user: { email: string };
};

type Attendance = {
  id: string;
  checkInAt: string;
  checkOutAt?: string;
  member: { id: string; firstName: string; lastName: string };
};

export function AttendanceDesk() {
  const [q, setQ] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [today, setToday] = useState<Attendance[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    const t = await api<Attendance[]>('/attendance/today');
    setToday(t);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);

  async function search() {
    const list = await api<Member[]>(`/members?q=${encodeURIComponent(q)}`);
    setMembers(list);
  }

  async function checkIn(memberId: string) {
    setError('');
    setMessage('');
    try {
      await api('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ memberId }),
      });
      setMessage('Checked in');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function checkOut(memberId: string) {
    setError('');
    setMessage('');
    try {
      await api('/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({ memberId }),
      });
      setMessage('Checked out');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Front desk check-in</h1>
        <p className="mt-1 text-ink-800/70">Search a member, then time in or out.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-md"
          placeholder="Search members"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button type="button" className="btn-primary" onClick={() => search().catch((e) => setError(e.message))}>
          Search
        </button>
      </div>

      {message ? <p className="text-sm text-moss-700">{message}</p> : null}
      {error ? <p className="text-sm text-ember-500">{error}</p> : null}

      {members.length > 0 ? (
        <ul className="card-panel divide-y divide-ink-800/5">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">
                  {m.firstName} {m.lastName}
                </p>
                <p className="text-sm text-ink-800/60">
                  {m.user.email} · {m.status}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-primary" onClick={() => checkIn(m.id)}>
                  Time in
                </button>
                <button type="button" className="btn-secondary" onClick={() => checkOut(m.id)}>
                  Time out
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <section className="card-panel">
        <h2 className="font-display text-xl font-semibold">Today on the floor</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {today.map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-ink-800/5 pb-2">
              <span>
                {a.member.firstName} {a.member.lastName}
              </span>
              <span>
                In {new Date(a.checkInAt).toLocaleTimeString()}
                {a.checkOutAt
                  ? ` · Out ${new Date(a.checkOutAt).toLocaleTimeString()}`
                  : ' · Open'}
              </span>
            </li>
          ))}
          {!today.length ? <li className="text-ink-800/60">No check-ins yet today.</li> : null}
        </ul>
      </section>
    </div>
  );
}
