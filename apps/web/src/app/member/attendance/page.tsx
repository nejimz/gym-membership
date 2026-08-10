'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Attendance = { id: string; checkInAt: string; checkOutAt?: string };

export default function Page() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Attendance[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.memberId) return;
    api<Attendance[]>(`/attendance/member/${user.memberId}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [user?.memberId]);

  return (
    <AppShell role="MEMBER">
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Visit history</h1>
          <p className="mt-1 text-ink-800/70">Your time-in and time-out records.</p>
        </div>
        {error ? <p className="text-ember-500">{error}</p> : null}
        <ul className="card-panel divide-y divide-ink-800/5">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
              <span>{new Date(r.checkInAt).toLocaleString()}</span>
              <span className="text-ink-800/60">
                {r.checkOutAt ? `Out ${new Date(r.checkOutAt).toLocaleString()}` : 'Still open'}
              </span>
            </li>
          ))}
          {!rows.length ? <li className="py-3 text-ink-800/60">No visits yet.</li> : null}
        </ul>
      </div>
    </AppShell>
  );
}
