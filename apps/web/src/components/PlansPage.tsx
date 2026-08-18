'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { ConfirmDialog, FlashBanner } from '@/components/Feedback';

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

const CREATE_BUSY = '__create__';

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m6.3 6.3 11.4 11.4" />
    </svg>
  );
}

function RecycleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function IconAction({
  label,
  tooltip,
  className,
  disabled,
  onClick,
  children,
}: {
  label: string;
  tooltip: string;
  className: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`group relative inline-flex items-center justify-center rounded-md p-1.5 disabled:opacity-50 ${className}`}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute right-full top-1/2 z-10 mr-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-xs font-medium text-sand-50 opacity-0 shadow-soft transition group-hover:opacity-100 group-focus-visible:opacity-100 group-disabled:hidden"
      >
        {tooltip}
      </span>
    </button>
  );
}

export function PlansPage() {
  const { formatMoney } = useSettings();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [pendingDeactivate, setPendingDeactivate] = useState<Plan | null>(null);

  const formBusy = busyPlanId === (editingId ?? CREATE_BUSY);

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
    setBusyPlanId(editingId ?? CREATE_BUSY);
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
      setBusyPlanId(null);
    }
  }

  async function setActive(plan: Plan, active: boolean) {
    setBusyPlanId(plan.id);
    setError('');
    setSaved('');
    setPendingDeactivate(null);
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
      setBusyPlanId(null);
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

      {error ? (
        <FlashBanner kind="error" message={error} onDismiss={() => setError('')} />
      ) : null}
      {saved ? (
        <FlashBanner kind="success" message={saved} onDismiss={() => setSaved('')} />
      ) : null}

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
            <button type="submit" className="btn-primary" disabled={formBusy}>
              {editingId ? 'Save changes' : 'Create plan'}
            </button>
            <button type="button" className="btn-ghost" onClick={closeForm} disabled={formBusy}>
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
            {plans.map((plan) => {
              const rowBusy = busyPlanId === plan.id;
              return (
                <tr key={plan.id} className="border-b border-ink-800/5">
                  <td className="px-4 py-3 font-medium">{plan.name}</td>
                  <td className="px-4 py-3">{plan.durationDays} days</td>
                  <td className="px-4 py-3">{formatMoney(plan.price)}</td>
                  <td className="px-4 py-3 text-ink-800/80">{plan.description || '—'}</td>
                  <td className="px-4 py-3">{plan.active ? 'Active' : 'Inactive'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <IconAction
                        label={`Edit ${plan.name}`}
                        tooltip="Edit"
                        className="text-moss-700 hover:bg-moss-700/10"
                        disabled={rowBusy}
                        onClick={() => openEdit(plan)}
                      >
                        <PencilIcon />
                      </IconAction>
                      {plan.active ? (
                        <IconAction
                          label={`Deactivate ${plan.name}`}
                          tooltip="Deactivate"
                          className="text-ember-500 hover:bg-ember-500/10"
                          disabled={rowBusy}
                          onClick={() => setPendingDeactivate(plan)}
                        >
                          <BanIcon />
                        </IconAction>
                      ) : (
                        <IconAction
                          label={`Reactivate ${plan.name}`}
                          tooltip="Reactivate"
                          className="text-moss-700 hover:bg-moss-700/10"
                          disabled={rowBusy}
                          onClick={() => void setActive(plan, true)}
                        >
                          <RecycleIcon />
                        </IconAction>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
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

      {pendingDeactivate ? (
        <ConfirmDialog
          title={`Deactivate ${pendingDeactivate.name}?`}
          body="Existing members keep this plan. It will be hidden when assigning a plan to a new member."
          confirmLabel="Deactivate"
          onCancel={() => setPendingDeactivate(null)}
          onConfirm={() => void setActive(pendingDeactivate, false)}
        />
      ) : null}
    </div>
  );
}
