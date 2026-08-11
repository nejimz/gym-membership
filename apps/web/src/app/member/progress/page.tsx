'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ComposedMetricChart, LineMetricChart } from '@/components/Charts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Sex = 'MALE' | 'FEMALE';

type Metric = {
  recordedAt: string;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  chestCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  armsCm?: number | null;
  thighsCm?: number | null;
  neckCm?: number | null;
  restingHrBpm?: number | null;
  leanMassKg?: number | null;
  estimatedLeanMassKg?: number | null;
  effectiveLeanMassKg?: number | null;
  notes?: string | null;
  photoUrl?: string | null;
};

type Profile = {
  id: string;
  heightCm?: number | null;
  sex?: Sex | null;
};

type CorrelationRow = {
  month: string;
  visitCount: number;
  avgWeightKg: number | null;
  weightDeltaKg: number | null;
};

const emptyForm = {
  weightKg: '',
  bodyFatPct: '',
  chestCm: '',
  waistCm: '',
  hipsCm: '',
  armsCm: '',
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

export default function Page() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [correlation, setCorrelation] = useState<CorrelationRow[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [heightCm, setHeightCm] = useState('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);

  async function load() {
    if (!user?.memberId) return;
    const [list, corr, me] = await Promise.all([
      api<Metric[]>(`/progress/${user.memberId}`),
      api<CorrelationRow[]>(`/progress/${user.memberId}/activity-correlation?months=6`),
      api<Profile>('/members/me'),
    ]);
    setMetrics(list);
    setCorrelation(corr);
    setProfile(me);
    setHeightCm(me.heightCm != null ? String(me.heightCm) : '');
    setSex(me.sex ?? '');
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [user?.memberId]);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user?.memberId) return;
    await api(`/members/${user.memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        heightCm: heightCm ? Number(heightCm) : undefined,
        sex: sex || undefined,
      }),
    });
    await load();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api('/progress', {
      method: 'POST',
      body: JSON.stringify({
        weightKg: num(form.weightKg),
        bodyFatPct: num(form.bodyFatPct),
        chestCm: num(form.chestCm),
        waistCm: num(form.waistCm),
        hipsCm: num(form.hipsCm),
        armsCm: num(form.armsCm),
        thighsCm: num(form.thighsCm),
        neckCm: num(form.neckCm),
        restingHrBpm: form.restingHrBpm ? Number(form.restingHrBpm) : undefined,
        leanMassKg: num(form.leanMassKg),
        notes: form.notes || undefined,
        photoUrl: form.photoUrl || undefined,
      }),
    });
    setForm(emptyForm);
    await load();
  }

  const chartData = metrics.map((m) => ({
    label: new Date(m.recordedAt).toLocaleDateString(),
    weightKg: m.weightKg,
    bodyFatPct: m.bodyFatPct,
    waistCm: m.waistCm,
    effectiveLeanMassKg: m.effectiveLeanMassKg,
    restingHrBpm: m.restingHrBpm,
  }));

  const correlationChart = correlation.map((row) => ({
    label: row.month.slice(5),
    visitCount: row.visitCount,
    avgWeightKg: row.avgWeightKg,
  }));

  return (
    <AppShell role="MEMBER">
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Body progress</h1>
          <p className="mt-1 text-ink-800/70">
            Track weight, composition, measurements, and how workouts relate to change.
          </p>
        </div>
        {error ? <p className="text-ember-500">{error}</p> : null}

        <form onSubmit={onSaveProfile} className="card-panel grid gap-3 md:grid-cols-3">
          <div>
            <h2 className="font-display text-lg font-semibold md:col-span-3">Body profile</h2>
            <p className="mt-1 text-sm text-ink-800/60 md:col-span-3">
              Height and sex power Navy lean-mass estimates when neck/waist are logged.
            </p>
          </div>
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
          <div className="flex items-end">
            <button type="submit" className="btn-primary">
              Save profile
            </button>
          </div>
          {profile?.heightCm != null || profile?.sex ? (
            <p className="text-sm text-ink-800/60 md:col-span-3">
              Saved: {profile.heightCm != null ? `${profile.heightCm} cm` : '—'} ·{' '}
              {profile.sex ?? '—'}
            </p>
          ) : null}
        </form>

        <section className="card-panel grid gap-4 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-lg font-semibold">Weight</h2>
            <LineMetricChart data={chartData} dataKey="weightKg" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Body fat %</h2>
            <LineMetricChart data={chartData} dataKey="bodyFatPct" color="#c45c26" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Lean mass (kg)</h2>
            <LineMetricChart data={chartData} dataKey="effectiveLeanMassKg" color="#1f5f8b" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Resting HR (bpm)</h2>
            <LineMetricChart data={chartData} dataKey="restingHrBpm" color="#7a3e2f" />
          </div>
        </section>

        <section className="card-panel">
          <h2 className="font-display text-lg font-semibold">Workouts vs weight</h2>
          <p className="mt-1 text-sm text-ink-800/60">
            Monthly visit count (bars) against average weight (line).
          </p>
          <div className="mt-3">
            <ComposedMetricChart data={correlationChart} />
          </div>
        </section>

        <form onSubmit={onSubmit} className="card-panel grid gap-3 md:grid-cols-3">
          {(
            [
              ['weightKg', 'Weight (kg)'],
              ['bodyFatPct', 'Body fat %'],
              ['leanMassKg', 'Lean mass kg (optional)'],
              ['chestCm', 'Chest (cm)'],
              ['waistCm', 'Waist (cm)'],
              ['hipsCm', 'Hips (cm)'],
              ['armsCm', 'Arms (cm)'],
              ['thighsCm', 'Thighs (cm)'],
              ['neckCm', 'Neck (cm)'],
              ['restingHrBpm', 'Resting HR (bpm)'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                className="input"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                inputMode="decimal"
              />
            </div>
          ))}
          <div>
            <label className="label">Notes</label>
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Photo URL</label>
            <input
              className="input"
              value={form.photoUrl}
              onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
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
                <th className="px-4 py-3">Lean mass</th>
                <th className="px-4 py-3">Waist</th>
                <th className="px-4 py-3">Thighs</th>
                <th className="px-4 py-3">Neck</th>
                <th className="px-4 py-3">RHR</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {[...metrics].reverse().map((m, i) => {
                const leanDisplay =
                  m.leanMassKg != null
                    ? m.leanMassKg
                    : m.estimatedLeanMassKg != null
                      ? m.estimatedLeanMassKg
                      : null;
                const leanEstimated = m.leanMassKg == null && leanDisplay != null;
                return (
                  <tr key={i} className="border-t border-ink-800/5">
                    <td className="px-4 py-3">{new Date(m.recordedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{m.weightKg ?? '—'}</td>
                    <td className="px-4 py-3">{m.bodyFatPct ?? '—'}</td>
                    <td className={`px-4 py-3 ${leanEstimated ? 'italic text-ink-800/70' : ''}`}>
                      {leanDisplay ?? '—'}
                      {leanEstimated ? ' est.' : ''}
                    </td>
                    <td className="px-4 py-3">{m.waistCm ?? '—'}</td>
                    <td className="px-4 py-3">{m.thighsCm ?? '—'}</td>
                    <td className="px-4 py-3">{m.neckCm ?? '—'}</td>
                    <td className="px-4 py-3">{m.restingHrBpm ?? '—'}</td>
                    <td className="px-4 py-3">{m.notes || m.photoUrl || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
