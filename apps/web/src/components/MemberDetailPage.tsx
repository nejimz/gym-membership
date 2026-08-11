'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ComposedMetricChart, LineMetricChart } from '@/components/Charts';

type Sex = 'MALE' | 'FEMALE';

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: string;
  endDate?: string;
  dateOfBirth?: string;
  emergencyContact?: string;
  heightCm?: number | null;
  sex?: Sex | null;
  plan?: { name: string };
  user: { email: string };
  attendances: { checkInAt: string; checkOutAt?: string }[];
};

type Metric = {
  id: string;
  recordedAt: string;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  waistCm?: number | null;
  thighsCm?: number | null;
  neckCm?: number | null;
  restingHrBpm?: number | null;
  leanMassKg?: number | null;
  estimatedLeanMassKg?: number | null;
  effectiveLeanMassKg?: number | null;
  notes?: string | null;
  photoUrl?: string | null;
};

type CorrelationRow = {
  month: string;
  visitCount: number;
  avgWeightKg: number | null;
  weightDeltaKg: number | null;
};

const emptyMetricForm = {
  weightKg: '',
  bodyFatPct: '',
  waistCm: '',
  hipsCm: '',
  thighsCm: '',
  neckCm: '',
  restingHrBpm: '',
  leanMassKg: '',
  notes: '',
  photoUrl: '',
};

function num(value: string) {
  return value ? Number(value) : undefined;
}

export function MemberDetailPage({
  memberId,
  canEditPlan,
}: {
  memberId: string;
  canEditPlan: boolean;
}) {
  const [member, setMember] = useState<Member | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [correlation, setCorrelation] = useState<CorrelationRow[]>([]);
  const [error, setError] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [metricForm, setMetricForm] = useState(emptyMetricForm);

  async function load() {
    const [m, prog, corr] = await Promise.all([
      api<Member>(`/members/${memberId}`),
      api<Metric[]>(`/progress/${memberId}`),
      api<CorrelationRow[]>(`/progress/${memberId}/activity-correlation?months=6`),
    ]);
    setMember(m);
    setMetrics(prog);
    setCorrelation(corr);
    setHeightCm(m.heightCm != null ? String(m.heightCm) : '');
    setSex(m.sex ?? '');
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

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    await api(`/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        heightCm: heightCm ? Number(heightCm) : undefined,
        sex: sex || undefined,
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
        weightKg: num(metricForm.weightKg),
        bodyFatPct: num(metricForm.bodyFatPct),
        waistCm: num(metricForm.waistCm),
        hipsCm: num(metricForm.hipsCm),
        thighsCm: num(metricForm.thighsCm),
        neckCm: num(metricForm.neckCm),
        restingHrBpm: metricForm.restingHrBpm
          ? Number(metricForm.restingHrBpm)
          : undefined,
        leanMassKg: num(metricForm.leanMassKg),
        notes: metricForm.notes || undefined,
        photoUrl: metricForm.photoUrl || undefined,
      }),
    });
    setMetricForm(emptyMetricForm);
    await load();
  }

  if (error) return <p className="text-ember-500">{error}</p>;
  if (!member) return <p>Loading…</p>;

  const chartData = metrics.map((m) => ({
    label: new Date(m.recordedAt).toLocaleDateString(),
    weightKg: m.weightKg,
    bodyFatPct: m.bodyFatPct,
    effectiveLeanMassKg: m.effectiveLeanMassKg,
    restingHrBpm: m.restingHrBpm,
  }));

  const correlationChart = correlation.map((row) => ({
    label: row.month.slice(5),
    visitCount: row.visitCount,
    avgWeightKg: row.avgWeightKg,
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
          <form onSubmit={saveProfile} className="mt-3 grid gap-2 border-t border-ink-800/10 pt-3">
            <p className="font-medium">Body profile</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="label">Height (cm)</label>
                <input
                  className="input"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className="label">Sex</label>
                <select
                  className="input"
                  value={sex}
                  onChange={(e) => setSex(e.target.value as Sex | '')}
                >
                  <option value="">Select…</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn-primary w-fit">
              Save body profile
            </button>
          </form>
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
          <LineMetricChart data={chartData} dataKey="effectiveLeanMassKg" color="#1f5f8b" />
          <LineMetricChart data={chartData} dataKey="restingHrBpm" color="#7a3e2f" />
        </div>

        <div className="mt-6">
          <h3 className="font-display text-lg font-semibold">Workouts vs weight</h3>
          <ComposedMetricChart data={correlationChart} />
        </div>

        <form onSubmit={addMetric} className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          {(
            [
              ['weightKg', 'Weight kg'],
              ['bodyFatPct', 'Body fat %'],
              ['leanMassKg', 'Lean mass kg'],
              ['waistCm', 'Waist cm'],
              ['hipsCm', 'Hips cm'],
              ['thighsCm', 'Thighs cm'],
              ['neckCm', 'Neck cm'],
              ['restingHrBpm', 'Resting HR'],
              ['notes', 'Notes / photo URL'],
            ] as const
          ).map(([key, placeholder]) => (
            <input
              key={key}
              className="input"
              placeholder={placeholder}
              value={metricForm[key]}
              onChange={(e) => setMetricForm({ ...metricForm, [key]: e.target.value })}
            />
          ))}
          <button type="submit" className="btn-primary">
            Log metrics
          </button>
        </form>
      </section>
    </div>
  );
}
