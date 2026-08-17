'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ComposedMetricChart, LineMetricChart } from '@/components/Charts';
import { ConfirmDialog, FlashBanner } from '@/components/Feedback';

type Sex = 'MALE' | 'FEMALE';
type MembershipStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';

type Plan = { id: string; name: string; durationDays: number };

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status: MembershipStatus;
  endDate?: string | null;
  dateOfBirth?: string | null;
  emergencyContact?: string | null;
  heightCm?: number | null;
  sex?: Sex | null;
  planId?: string | null;
  plan?: { name: string } | null;
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

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
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
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<'renew' | 'profile' | 'metrics' | null>(null);
  const [confirm, setConfirm] = useState<'renew' | 'profile' | 'metrics' | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [planId, setPlanId] = useState('');
  const [status, setStatus] = useState<MembershipStatus>('ACTIVE');
  const [metricForm, setMetricForm] = useState(emptyMetricForm);

  function applyMember(m: Member) {
    setMember(m);
    setFirstName(m.firstName);
    setLastName(m.lastName);
    setPhone(m.phone ?? '');
    setDateOfBirth(toDateInput(m.dateOfBirth));
    setEmergencyContact(m.emergencyContact ?? '');
    setHeightCm(m.heightCm != null ? String(m.heightCm) : '');
    setSex(m.sex ?? '');
    setPlanId(m.planId ?? '');
    setStatus(m.status);
  }

  async function load() {
    const [m, prog, corr, p] = await Promise.all([
      api<Member>(`/members/${memberId}`),
      api<Metric[]>(`/progress/${memberId}`),
      api<CorrelationRow[]>(`/progress/${memberId}/activity-correlation?months=6`),
      canEditPlan ? api<Plan[]>('/plans') : Promise.resolve([] as Plan[]),
    ]);
    applyMember(m);
    setMetrics(prog);
    setCorrelation(corr);
    if (canEditPlan) setPlans(Array.isArray(p) ? p : []);
    setError('');
  }

  useEffect(() => {
    let cancelled = false;
    load().catch((e) => {
      if (!cancelled) {
        setNotice('');
        setError(e instanceof Error ? e.message : 'Failed to load member');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function renew() {
    if (!member || busy) return;
    const end = new Date();
    end.setDate(end.getDate() + 30);
    try {
      setBusy('renew');
      setConfirm(null);
      setError('');
      setNotice('');
      await api(`/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'ACTIVE',
          endDate: end.toISOString(),
          startDate: new Date().toISOString(),
        }),
      });
      await load();
      setNotice(
        `Membership renewed through ${end.toLocaleDateString()}.`,
      );
    } catch (e) {
      setNotice('');
      setError(e instanceof Error ? e.message : 'Failed to renew membership');
    } finally {
      setBusy(null);
    }
  }

  function requestSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setConfirm('profile');
  }

  async function saveProfile() {
    if (busy) return;
    try {
      setBusy('profile');
      setConfirm(null);
      setError('');
      setNotice('');
      await api(`/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
          dateOfBirth: dateOfBirth || null,
          emergencyContact: emergencyContact.trim() || null,
          heightCm: heightCm ? Number(heightCm) : null,
          sex: sex || null,
          ...(canEditPlan
            ? {
                status,
                ...(planId !== (member?.planId ?? '')
                  ? { planId: planId || null }
                  : {}),
              }
            : {}),
        }),
      });
      await load();
      setNotice('Profile saved.');
    } catch (e) {
      setNotice('');
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setBusy(null);
    }
  }

  function requestAddMetric(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setConfirm('metrics');
  }

  async function addMetric() {
    if (busy) return;
    try {
      setBusy('metrics');
      setConfirm(null);
      setError('');
      setNotice('');
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
      setNotice('Metrics logged.');
    } catch (e) {
      setNotice('');
      setError(e instanceof Error ? e.message : 'Failed to log metrics');
    } finally {
      setBusy(null);
    }
  }

  if (!member) {
    if (error) {
      return (
        <FlashBanner kind="error" message={error} onDismiss={() => setError('')} />
      );
    }
    return <p>Loading…</p>;
  }

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

  const renewEnd = new Date();
  renewEnd.setDate(renewEnd.getDate() + 30);
  const confirmCopy =
    confirm === 'renew'
      ? {
          title: 'Renew membership?',
          body: `This sets ${member.firstName} ${member.lastName} to Active and moves the end date to ${renewEnd.toLocaleDateString()} (30 days from today).`,
          confirmLabel: 'Renew',
        }
      : confirm === 'profile'
        ? {
            title: 'Save profile?',
            body: `Update the profile for ${firstName.trim() || member.firstName} ${lastName.trim() || member.lastName}.`,
            confirmLabel: 'Save',
          }
        : confirm === 'metrics'
          ? {
              title: 'Log metrics?',
              body: `Add a new body-progress entry for ${member.firstName} ${member.lastName}.`,
              confirmLabel: 'Log metrics',
            }
          : null;

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
          <button
            type="button"
            className="btn-primary"
            disabled={busy != null}
            onClick={() => setConfirm('renew')}
          >
            {busy === 'renew' ? 'Renewing…' : 'Renew +30 days'}
          </button>
        ) : null}
      </div>

      {error ? (
        <FlashBanner kind="error" message={error} onDismiss={() => setError('')} />
      ) : null}
      {notice ? (
        <FlashBanner kind="success" message={notice} onDismiss={() => setNotice('')} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card-panel space-y-3 text-sm">
          <h2 className="font-display text-xl font-semibold">Profile</h2>
          <p className="text-ink-800/70">{member.user.email}</p>
          <p>
            Ends:{' '}
            {member.endDate ? new Date(member.endDate).toLocaleDateString() : '—'}
          </p>
          <form onSubmit={requestSaveProfile} className="grid gap-3 border-t border-ink-800/10 pt-3">
            <div className="grid items-end gap-2 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="member-first-name">
                  First name
                </label>
                <input
                  id="member-first-name"
                  className="input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="member-last-name">
                  Last name
                </label>
                <input
                  id="member-last-name"
                  className="input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="member-phone">
                  Phone
                </label>
                <input
                  id="member-phone"
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="member-dob">
                  Date of birth
                </label>
                <input
                  id="member-dob"
                  className="input"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="member-emergency">
                Emergency contact
              </label>
              <input
                id="member-emergency"
                className="input"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Name and phone, e.g. Jane Doe 555-1234"
              />
            </div>
            <p className="font-medium">Body profile</p>
            <div className="grid items-end gap-2 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="member-height">
                  Height (cm)
                </label>
                <input
                  id="member-height"
                  className="input"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className="label" htmlFor="member-sex">
                  Sex
                </label>
                <select
                  id="member-sex"
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
            {canEditPlan ? (
              <div className="grid items-end gap-2 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="member-plan">
                    Plan
                  </label>
                  <select
                    id="member-plan"
                    className="input"
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                  >
                    <option value="">No plan</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="member-status">
                    Status
                  </label>
                  <select
                    id="member-status"
                    className="input"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MembershipStatus)}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                </div>
              </div>
            ) : null}
            <button type="submit" className="btn-primary w-fit" disabled={busy != null}>
              {busy === 'profile' ? 'Saving…' : 'Save profile'}
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
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold">Weight</h3>
            <LineMetricChart data={chartData} dataKey="weightKg" name="Weight (kg)" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold">Body fat %</h3>
            <LineMetricChart
              data={chartData}
              dataKey="bodyFatPct"
              name="Body fat %"
              color="#c45c26"
            />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold">Lean mass (kg)</h3>
            <LineMetricChart
              data={chartData}
              dataKey="effectiveLeanMassKg"
              name="Lean mass (kg)"
              color="#1f5f8b"
            />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold">Resting HR (bpm)</h3>
            <LineMetricChart
              data={chartData}
              dataKey="restingHrBpm"
              name="Resting HR (bpm)"
              color="#7a3e2f"
            />
          </div>
        </div>

        <div className="mt-6 min-w-0">
          <h3 className="font-display text-lg font-semibold">Workouts vs weight</h3>
          <ComposedMetricChart data={correlationChart} />
        </div>

        <form onSubmit={requestAddMetric} className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-5">
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
              ['notes', 'Notes'],
              ['photoUrl', 'Photo URL'],
            ] as const
          ).map(([key, placeholder]) => (
            <input
              key={key}
              className="input"
              placeholder={placeholder}
              aria-label={placeholder}
              value={metricForm[key]}
              onChange={(e) => setMetricForm({ ...metricForm, [key]: e.target.value })}
            />
          ))}
          <button type="submit" className="btn-primary" disabled={busy != null}>
            {busy === 'metrics' ? 'Logging…' : 'Log metrics'}
          </button>
        </form>
      </section>

      {confirm && confirmCopy ? (
        <ConfirmDialog
          title={confirmCopy.title}
          body={confirmCopy.body}
          confirmLabel={confirmCopy.confirmLabel}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm === 'renew') void renew();
            else if (confirm === 'profile') void saveProfile();
            else void addMetric();
          }}
        />
      ) : null}
    </div>
  );
}
