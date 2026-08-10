'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LineMetricChart } from '@/components/Charts';

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: string;
  endDate?: string;
  dateOfBirth?: string;
  emergencyContact?: string;
  plan?: { name: string };
  user: { email: string };
  attendances: { checkInAt: string; checkOutAt?: string }[];
};

type Metric = {
  id: string;
  recordedAt: string;
  weightKg?: number;
  bodyFatPct?: number;
  waistCm?: number;
  notes?: string;
  photoUrl?: string;
};

export function MemberDetailPage({
  memberId,
  canEditPlan,
}: {
  memberId: string;
  canEditPlan: boolean;
}) {
  const [member, setMember] = useState<Member | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [error, setError] = useState('');
  const [metricForm, setMetricForm] = useState({
    weightKg: '',
    bodyFatPct: '',
    waistCm: '',
    notes: '',
    photoUrl: '',
  });

  async function load() {
    const [m, prog] = await Promise.all([
      api<Member>(`/members/${memberId}`),
      api<Metric[]>(`/progress/${memberId}`),
    ]);
    setMember(m);
    setMetrics(prog);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [memberId]);

  async function renew() {
    if (!member) return;
    const end = new Date();
    end.setDate(end.getDate() + 30);
    await api(`/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'ACTIVE',
        endDate: end.toISOString(),
        startDate: new Date().toISOString(),
      }),
    });
    await load();
  }

  async function addMetric(e: FormEvent) {
    e.preventDefault();
    await api('/progress', {
      method: 'POST',
      body: JSON.stringify({
        memberId,
        weightKg: metricForm.weightKg ? Number(metricForm.weightKg) : undefined,
        bodyFatPct: metricForm.bodyFatPct ? Number(metricForm.bodyFatPct) : undefined,
        waistCm: metricForm.waistCm ? Number(metricForm.waistCm) : undefined,
        notes: metricForm.notes || undefined,
        photoUrl: metricForm.photoUrl || undefined,
      }),
    });
    setMetricForm({ weightKg: '', bodyFatPct: '', waistCm: '', notes: '', photoUrl: '' });
    await load();
  }

  if (error) return <p className="text-ember-500">{error}</p>;
  if (!member) return <p>Loading…</p>;

  const chartData = metrics.map((m) => ({
    label: new Date(m.recordedAt).toLocaleDateString(),
    weightKg: m.weightKg,
    bodyFatPct: m.bodyFatPct,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">
            {member.firstName} {member.lastName}
          </h1>
          <p className="mt-1 text-ink-800/70">
            {member.user.email} · {member.plan?.name ?? 'No plan'} · {member.status}
          </p>
        </div>
        {canEditPlan ? (
          <button type="button" className="btn-primary" onClick={() => renew().catch((e) => setError(e.message))}>
            Renew +30 days
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card-panel space-y-2 text-sm">
          <h2 className="font-display text-xl font-semibold">Profile</h2>
          <p>Phone: {member.phone || '—'}</p>
          <p>
            DOB:{' '}
            {member.dateOfBirth
              ? new Date(member.dateOfBirth).toLocaleDateString()
              : '—'}
          </p>
          <p>Emergency: {member.emergencyContact || '—'}</p>
          <p>
            Ends:{' '}
            {member.endDate ? new Date(member.endDate).toLocaleDateString() : '—'}
          </p>
        </section>
        <section className="card-panel">
          <h2 className="font-display text-xl font-semibold">Recent visits</h2>
          <ul className="mt-3 max-h-48 space-y-2 overflow-auto text-sm">
            {member.attendances?.map((a, i) => (
              <li key={i} className="flex justify-between gap-2 border-b border-ink-800/5 pb-1">
                <span>{new Date(a.checkInAt).toLocaleString()}</span>
                <span className="text-ink-800/60">
                  {a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString() : 'Open'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card-panel">
        <h2 className="font-display text-xl font-semibold">Body progress</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <LineMetricChart data={chartData} dataKey="weightKg" />
          <LineMetricChart data={chartData} dataKey="bodyFatPct" color="#c45c26" />
        </div>
        <form onSubmit={addMetric} className="mt-4 grid gap-3 md:grid-cols-5">
          <input
            className="input"
            placeholder="Weight kg"
            value={metricForm.weightKg}
            onChange={(e) => setMetricForm({ ...metricForm, weightKg: e.target.value })}
          />
          <input
            className="input"
            placeholder="Body fat %"
            value={metricForm.bodyFatPct}
            onChange={(e) => setMetricForm({ ...metricForm, bodyFatPct: e.target.value })}
          />
          <input
            className="input"
            placeholder="Waist cm"
            value={metricForm.waistCm}
            onChange={(e) => setMetricForm({ ...metricForm, waistCm: e.target.value })}
          />
          <input
            className="input"
            placeholder="Notes / photo URL"
            value={metricForm.notes}
            onChange={(e) => setMetricForm({ ...metricForm, notes: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            Log metrics
          </button>
        </form>
      </section>
    </div>
  );
}
