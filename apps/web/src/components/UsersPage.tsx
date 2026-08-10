'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, Role } from '@/lib/api';
import { useSettings } from '@/lib/settings';

type Plan = { id: string; name: string; durationDays: number; price: string };

type UserRow = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  member?: { id: string; firstName: string; lastName: string } | null;
};

type UsersResponse = {
  data: UserRow[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 25;
const ROLES: Role[] = ['ADMIN', 'STAFF', 'MEMBER'];

export function UsersPage() {
  const { formatMoney } = useSettings();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | Role>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: 'password123',
    role: 'STAFF' as Role,
    firstName: '',
    lastName: '',
    phone: '',
    planId: '',
    dateOfBirth: '',
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isMember = form.role === 'MEMBER';

  async function load(search = q, role = roleFilter, nextPage = page) {
    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: String(PAGE_SIZE),
    });
    if (search) params.set('q', search);
    if (role) params.set('role', role);

    const [res, p] = await Promise.all([
      api<UsersResponse>(`/users?${params}`),
      api<Plan[]>('/plans'),
    ]);
    setUsers(Array.isArray(res.data) ? res.data : []);
    setTotal(typeof res.total === 'number' ? res.total : 0);
    setPage(typeof res.page === 'number' ? res.page : nextPage);
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
      await load(q, roleFilter, 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    }
  }

  async function goToPage(nextPage: number) {
    const clamped = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(clamped);
    try {
      await load(q, roleFilter, clamped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const body: Record<string, string | undefined> = {
        email: form.email,
        password: form.password,
        role: form.role,
      };
      if (form.role === 'MEMBER') {
        body.firstName = form.firstName;
        body.lastName = form.lastName;
        body.phone = form.phone || undefined;
        body.planId = form.planId || undefined;
        body.dateOfBirth = form.dateOfBirth || undefined;
      }
      await api('/users', {
        method: 'POST',
        body: JSON.stringify(body),
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
      await load(q, roleFilter, 1);
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
          <h1 className="page-title">Users</h1>
          <p className="mt-1 text-ink-800/70">Create admin, staff, and member login accounts.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close form' : 'Add user'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-md"
          placeholder="Search email or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearch();
          }}
        />
        <select
          className="input w-auto"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as '' | Role)}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button type="button" className="btn-secondary" onClick={onSearch}>
          Search
        </button>
      </div>

      {error ? <p className="text-sm text-ember-500">{error}</p> : null}

      {showForm ? (
        <form onSubmit={onCreate} className="card-panel grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Temp password</label>
            <input
              className="input"
              type="text"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {isMember ? (
            <>
              <div>
                <label className="label">First name</label>
                <input
                  className="input"
                  type="text"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Last name</label>
                <input
                  className="input"
                  type="text"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Date of birth</label>
                <input
                  className="input"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
              </div>
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
            </>
          ) : null}
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary">
              Create user
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-ink-800/10 bg-white/70">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-800/10 bg-sand-100/80 text-xs uppercase tracking-wide text-ink-800/60">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-ink-800/5">
                <td className="px-4 py-3 font-medium">{u.email}</td>
                <td className="px-4 py-3">{u.role}</td>
                <td className="px-4 py-3">
                  {u.member ? `${u.member.firstName} ${u.member.lastName}` : '—'}
                </td>
                <td className="px-4 py-3">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-ink-800/60" colSpan={4}>
                  No users found.
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
