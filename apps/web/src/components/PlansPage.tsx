'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/lib/settings';

type Plan = {
  id: string;
  name: string;
  durationDays: number;
  price: string;
  description: string | null;
  active: boolean;
};

const emptyForm = {
  name: '',
  durationDays: '30',
  price: '',
  description: '',
  active: true,
};

export function PlansPage() {
  const { formatMoney } = useSettings();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    const data = await api<Plan[]>('/plans/all');
    setPlans(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
    setSaved('');
  }

  function openEdit(plan: Plan) {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      durationDays: String(plan.durationDays),
      price: String(plan.price),
      description: plan.description ?? '',
      active: plan.active,
    });
    setShowForm(true);
    setError('');
    setSaved('');
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const body = {
        name: form.name.trim(),
        durationDays: Number(form.durationDays),
        price: Number(form.price),
        description: form.description.trim() || null,
        active: form.active,
      };
      if (editingId) {
        await api(`/plans/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setSaved('Plan updated.');
      } else {
        await api('/plans', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setSaved('Plan created.');
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function setActive(plan: Plan, active: boolean) {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      await api(`/plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      });
      setSaved(active ? 'Plan reactivated.' : 'Plan deactivated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Plans</h1>
          <p className="mt-1 text-ink-800/70">
            Set membership plan names, duration, and amounts. Inactive plans stay on existing
            members but are hidden from new assignments.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => (showForm && !editingId ? closeForm() : openCreate())}
        >
          {showForm && !editingId ? 'Close form' : 'Add plan'}
        </button>
      </div>

      {error ? <p className="text-sm text-ember-500">{error}</p> : null}
      {saved ? <p className="text-sm text-moss-700">{saved}</p> : null}

      {showForm ? (
        <form onSubmit={onSubmit} className="card-panel grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <h2 className="text-sm font-semibold text-ink-900">
              {editingId ? 'Edit plan' : 'New plan'}
            </h2>
          </div>
          <div>
            <label className="label" htmlFor="planName">
              Name
            </label>
            <input
              id="planName"
              className="input"
              required
              maxLength={120}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="planDuration">
              Duration (days)
            </label>
            <input
              id="planDuration"
              className="input"
              type="number"
              required
              min={1}
              step={1}
              value={form.durationDays}
              onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="planPrice">
              Amount
            </label>
            <input
              id="planPrice"
              className="input"
              type="number"
              required
              min={0}
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="planDescription">
              Description
            </label>
            <input
              id="planDescription"
              className="input"
              maxLength={500}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              id="planActive"
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <label htmlFor="planActive" className="text-sm text-ink-800">
              Active (shown when assigning a plan to a member)
            </label>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button type="submit" className="btn-primary" disabled={busy}>
              {editingId ? 'Save changes' : 'Create plan'}
            </button>
            <button type="button" className="btn-ghost" onClick={closeForm} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-ink-800/10 bg-white/70">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-800/10 bg-sand-100/80 text-xs uppercase tracking-wide text-ink-800/60">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-ink-800/5">
                <td className="px-4 py-3 font-medium">{plan.name}</td>
                <td className="px-4 py-3">{plan.durationDays} days</td>
                <td className="px-4 py-3">{formatMoney(plan.price)}</td>
                <td className="px-4 py-3 text-ink-800/80">{plan.description || '—'}</td>
                <td className="px-4 py-3">{plan.active ? 'Active' : 'Inactive'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-sm"
                      onClick={() => openEdit(plan)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-sm"
                      disabled={busy}
                      onClick={() => setActive(plan, !plan.active)}
                    >
                      {plan.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {plans.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-ink-800/60" colSpan={6}>
                  No plans yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
