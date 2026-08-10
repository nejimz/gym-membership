'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { LineMetricChart } from '@/components/Charts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Metric = {
  recordedAt: string;
  weightKg?: number;
  bodyFatPct?: number;
  waistCm?: number;
  chestCm?: number;
  notes?: string;
  photoUrl?: string;
};

export default function Page() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    weightKg: '',
    bodyFatPct: '',
    waistCm: '',
    notes: '',
    photoUrl: '',
  });

  async function load() {
    if (!user?.memberId) return;
    const list = await api<Metric[]>(`/progress/${user.memberId}`);
    setMetrics(list);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [user?.memberId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api('/progress', {
      method: 'POST',
      body: JSON.stringify({
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        bodyFatPct: form.bodyFatPct ? Number(form.bodyFatPct) : undefined,
        waistCm: form.waistCm ? Number(form.waistCm) : undefined,
        notes: form.notes || undefined,
        photoUrl: form.photoUrl || undefined,
      }),
    });
    setForm({ weightKg: '', bodyFatPct: '', waistCm: '', notes: '', photoUrl: '' });
    await load();
  }

  const chartData = metrics.map((m) => ({
    label: new Date(m.recordedAt).toLocaleDateString(),
    weightKg: m.weightKg,
    bodyFatPct: m.bodyFatPct,
    waistCm: m.waistCm,
  }));

  return (
    <AppShell role="MEMBER">
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Body progress</h1>
          <p className="mt-1 text-ink-800/70">Track weight, composition, and measurements over time.</p>
        </div>
        {error ? <p className="text-ember-500">{error}</p> : null}
        <section className="card-panel grid gap-4 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-lg font-semibold">Weight</h2>
            <LineMetricChart data={chartData} dataKey="weightKg" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Body fat %</h2>
            <LineMetricChart data={chartData} dataKey="bodyFatPct" color="#c45c26" />
          </div>
        </section>
        <form onSubmit={onSubmit} className="card-panel grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Weight (kg)</label>
            <input className="input" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
          </div>
          <div>
            <label className="label">Body fat %</label>
            <input className="input" value={form.bodyFatPct} onChange={(e) => setForm({ ...form, bodyFatPct: e.target.value })} />
          </div>
          <div>
            <label className="label">Waist (cm)</label>
            <input className="input" value={form.waistCm} onChange={(e) => setForm({ ...form, waistCm: e.target.value })} />
          </div>
          <div>
            <label className="label">Photo URL / notes</label>
            <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary">
              Save entry
            </button>
          </div>
        </form>
        <section className="overflow-x-auto rounded-2xl border border-ink-800/10 bg-white/70">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-sand-100/80 text-xs uppercase tracking-wide text-ink-800/60">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Weight</th>
                <th className="px-4 py-3">Body fat</th>
                <th className="px-4 py-3">Waist</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {[...metrics].reverse().map((m, i) => (
                <tr key={i} className="border-t border-ink-800/5">
                  <td className="px-4 py-3">{new Date(m.recordedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{m.weightKg ?? '—'}</td>
                  <td className="px-4 py-3">{m.bodyFatPct ?? '—'}</td>
                  <td className="px-4 py-3">{m.waistCm ?? '—'}</td>
                  <td className="px-4 py-3">{m.notes || m.photoUrl || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
