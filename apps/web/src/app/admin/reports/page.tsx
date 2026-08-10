'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { AttendanceBarChart } from '@/components/Charts';
import { api } from '@/lib/api';

export default function Page() {
  const [series, setSeries] = useState<{ date: string; count: number }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ date: string; count: number }[]>('/reports/attendance-series?days=30')
      .then(setSeries)
      .catch((e) => setError(e.message));
  }, []);

  async function downloadCsv() {
    const token = localStorage.getItem('access_token');
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/reports/attendance.csv?days=30`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' },
    );
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell role="ADMIN">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="page-title">Reports</h1>
            <p className="mt-1 text-ink-800/70">Attendance trends and CSV export.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => downloadCsv()}>
            Export CSV
          </button>
        </div>
        {error ? <p className="text-ember-500">{error}</p> : null}
        <section className="card-panel">
          <h2 className="font-display text-xl font-semibold">Attendance (30 days)</h2>
          <div className="mt-4">
            <AttendanceBarChart data={series} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
