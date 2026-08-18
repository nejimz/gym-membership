'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { api, Role } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { FlashBanner } from '@/components/Feedback';

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
const CREATE_BUSY = '__create__';
const DEFAULT_PASSWORD = 'password123';

const emptyForm = {
  email: '',
  password: DEFAULT_PASSWORD,
  role: 'STAFF' as Role,
  firstName: '',
  lastName: '',
  phone: '',
  planId: '',
  dateOfBirth: '',
};

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

export function UsersPage() {
  const { formatMoney } = useSettings();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | Role>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isMember = form.role === 'MEMBER';
  const formBusy = busyUserId === (editingId ?? CREATE_BUSY);

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
    load().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      planId: plans[0]?.id ?? '',
    });
    setShowForm(true);
    setError('');
    setSaved('');
  }

  function openEdit(user: UserRow) {
    setEditingId(user.id);
    setForm({
      email: user.email,
      password: '',
      role: user.role,
      firstName: user.member?.firstName ?? '',
      lastName: user.member?.lastName ?? '',
      phone: '',
      planId: plans[0]?.id ?? '',
      dateOfBirth: '',
    });
    setShowForm(true);
    setError('');
    setSaved('');
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({
      ...emptyForm,
      planId: plans[0]?.id ?? '',
    });
  }

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusyUserId(editingId ?? CREATE_BUSY);
    setError('');
    setSaved('');
    try {
      if (editingId) {
        const body: Record<string, string | undefined> = {
          email: form.email,
          role: form.role,
        };
        if (form.password.trim()) body.password = form.password;
        if (form.role === 'MEMBER') {
          body.firstName = form.firstName;
          body.lastName = form.lastName;
        }
        await api(`/users/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setSaved('User updated.');
      } else {
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
        setSaved('User created.');
      }
      const nextPage = editingId ? page : 1;
      closeForm();
      await load(q, roleFilter, nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusyUserId(null);
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
        <button
          type="button"
          className="btn-primary"
          onClick={() => (showForm && !editingId ? closeForm() : openCreate())}
        >
          {showForm && !editingId ? 'Close form' : 'Add user'}
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
              {editingId ? 'Edit user' : 'New user'}
            </h2>
          </div>
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
            <label className="label">
              {editingId ? 'New password (optional)' : 'Temp password'}
            </label>
            <input
              className="input"
              type="text"
              required={!editingId}
              minLength={form.password.trim() || !editingId ? 6 : undefined}
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
              {!editingId ? (
                <>
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
            </>
          ) : null}
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button type="submit" className="btn-primary" disabled={formBusy}>
              {editingId ? 'Save changes' : 'Create user'}
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
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const rowBusy = busyUserId === u.id;
              return (
                <tr key={u.id} className="border-b border-ink-800/5">
                  <td className="px-4 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3">
                    {u.member ? `${u.member.firstName} ${u.member.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <IconAction
                        label={`Edit ${u.email}`}
                        tooltip="Edit"
                        className="text-moss-700 hover:bg-moss-700/10"
                        disabled={rowBusy}
                        onClick={() => openEdit(u)}
                      >
                        <PencilIcon />
                      </IconAction>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-ink-800/60" colSpan={5}>
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
