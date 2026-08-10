'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/lib/settings';

type Plan = { id: string; name: string; durationDays: number; price: string };
type Member = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: string;
  endDate?: string;
  plan?: { name: string };
  user: { email: string };
};

export function MembersPage({ basePath }: { basePath: '/admin' | '/staff' }) {
  const { formatMoney } = useSettings();
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: 'password123',
    firstName: '',
    lastName: '',
    phone: '',
    planId: '',
    dateOfBirth: '',
  });

  async function load(search = q) {
    const query = search ? `?q=${encodeURIComponent(search)}` : '';
    const [m, p] = await Promise.all([
      api<Member[]>(`/members${query}`),
      api<Plan[]>('/plans'),
    ]);
    setMembers(m);
    setPlans(p);
    if (!form.planId && p[0]) {
      setForm((f) => ({ ...f, planId: p[0].id }));
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/members', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          planId: form.planId || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
        }),
      });
      setShowForm(false);
      setForm((f) => ({
        ...f,
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        dateOfBirth: '',
      }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Members</h1>
          <p className="mt-1 text-ink-800/70">Search, enroll, and manage memberships.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close form' : 'Add member'}
        </button>
      </div>

      <div className="flex gap-2">
        <input
          className="input max-w-md"
          placeholder="Search name, email, phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="btn-secondary" onClick={() => load(q)}>
          Search
        </button>
      </div>

      {error ? <p className="text-sm text-ember-500">{error}</p> : null}

      {showForm ? (
        <form onSubmit={onCreate} className="card-panel grid gap-3 md:grid-cols-2">
          {(
            [
              ['email', 'Email', 'email'],
              ['password', 'Temp password', 'text'],
              ['firstName', 'First name', 'text'],
              ['lastName', 'Last name', 'text'],
              ['phone', 'Phone', 'text'],
              ['dateOfBirth', 'Date of birth', 'date'],
            ] as const
          ).map(([key, label, type]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                className="input"
                type={type}
                required={key !== 'phone' && key !== 'dateOfBirth'}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <div>
            <label className="label">Plan</label>
            <select
              className="input"
              value={form.planId}
              onChange={(e) => setForm({ ...form, planId: e.target.value })}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatMoney(p.price)})
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary">
              Create member
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-ink-800/10 bg-white/70">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-800/10 bg-sand-100/80 text-xs uppercase tracking-wide text-ink-800/60">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ends</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-ink-800/5">
                <td className="px-4 py-3 font-medium">
                  {m.firstName} {m.lastName}
                </td>
                <td className="px-4 py-3">{m.user.email}</td>
                <td className="px-4 py-3">{m.plan?.name ?? '—'}</td>
                <td className="px-4 py-3">{m.status}</td>
                <td className="px-4 py-3">
                  {m.endDate ? new Date(m.endDate).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link className="text-moss-700 underline" href={`${basePath}/members/${m.id}`}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
