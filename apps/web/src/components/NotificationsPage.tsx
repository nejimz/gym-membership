'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt?: string;
  createdAt: string;
};

export function NotificationsPage({ canRunJobs = false }: { canRunJobs?: boolean }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function load() {
    const list = await api<Notification[]>('/notifications');
    setItems(list);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, { method: 'POST' });
    await load();
  }

  async function markAll() {
    await api('/notifications/read-all', { method: 'POST' });
    await load();
  }

  async function runJobs() {
    setInfo('');
    await api('/notifications/run-jobs', { method: 'POST' });
    setInfo('Renewal & birthday jobs executed. Check Mailhog at http://localhost:8025');
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="mt-1 text-ink-800/70">Renewals, birthdays, and system alerts.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={() => markAll()}>
            Mark all read
          </button>
          {canRunJobs ? (
            <button type="button" className="btn-secondary" onClick={() => runJobs().catch((e) => setError(e.message))}>
              Run daily jobs now
            </button>
          ) : null}
        </div>
      </div>
      {info ? <p className="text-sm text-moss-700">{info}</p> : null}
      {error ? <p className="text-sm text-ember-500">{error}</p> : null}
      <ul className="space-y-3">
        {items.map((n) => (
          <li
            key={n.id}
            className={`card-panel ${n.readAt ? 'opacity-70' : 'ring-1 ring-moss-500/30'}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-800/55">
                  {n.type} · {new Date(n.createdAt).toLocaleString()}
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold">{n.title}</h2>
                <p className="mt-1 text-sm text-ink-800/80">{n.body}</p>
              </div>
              {!n.readAt ? (
                <button type="button" className="btn-ghost" onClick={() => markRead(n.id)}>
                  Mark read
                </button>
              ) : null}
            </div>
          </li>
        ))}
        {!items.length ? <li className="text-ink-800/60">No notifications yet.</li> : null}
      </ul>
    </div>
  );
}
