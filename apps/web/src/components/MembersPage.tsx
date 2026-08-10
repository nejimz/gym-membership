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

type MembersResponse = {
  data: Member[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 25;

function normalizeMembersResponse(res: MembersResponse | Member[]): MembersResponse {
  if (Array.isArray(res)) {
    return { data: res, total: res.length, page: 1, pageSize: res.length || PAGE_SIZE };
  }
  return {
    data: Array.isArray(res.data) ? res.data : [],
    total: typeof res.total === 'number' ? res.total : 0,
    page: typeof res.page === 'number' ? res.page : 1,
    pageSize: typeof res.pageSize === 'number' ? res.pageSize : PAGE_SIZE,
  };
}

export function MembersPage({ basePath }: { basePath: '/admin' | '/staff' }) {
  const { formatMoney } = useSettings();
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function load(search = q, nextPage = page) {
    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: String(PAGE_SIZE),
    });
    if (search) params.set('q', search);

    const [rawMembers, p] = await Promise.all([
      api<MembersResponse | Member[]>(`/members?${params}`),
      api<Plan[]>('/plans'),
    ]);
    const m = normalizeMembersResponse(rawMembers);
    setMembers(m.data);
    setTotal(m.total);
    setPage(m.page);
    setPlans(Array.isArray(p) ? p : []);
    if (!form.planId && p[0]) {
      setForm((f) => ({ ...f, planId: p[0].id }));
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onSearch() {
    setPage(1);
    try {
      await load(q, 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    }
  }

  async function goToPage(nextPage: number) {
    const clamped = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(clamped);
    try {
      await load(q, clamped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }

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
      await load(q, 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

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
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearch();
          }}
        />
        <button type="button" className="btn-secondary" onClick={onSearch}>
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
            {members.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-ink-800/60" colSpan={6}>
                  No members found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-800/70">
        <p>
          Showing {from}–{to} of {total}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
