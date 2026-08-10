'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { resolveAssetUrl, useSettings } from '@/lib/settings';

export default function AdminSettingsPage() {
  const { settings, refresh, logoSrc } = useSettings();
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? '');
  const [currency, setCurrency] = useState(settings.currency);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCompanyName(settings.companyName);
    setLogoUrl(settings.logoUrl ?? '');
    setCurrency(settings.currency);
  }, [settings]);

  const previewSrc =
    logoUrl.trim() && !logoUrl.startsWith('/uploads/')
      ? resolveAssetUrl(logoUrl.trim())
      : logoSrc;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved('');
    try {
      await api('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          companyName,
          logoUrl: logoUrl.trim() || null,
          currency,
        }),
      });
      await refresh();
      setSaved('Settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const form = new FormData();
      form.append('logo', file);
      await api('/settings/logo', { method: 'POST', body: form });
      await refresh();
      setSaved('Logo uploaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onClearLogo() {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      await api('/settings/logo', { method: 'DELETE' });
      setLogoUrl('');
      await refresh();
      setSaved('Logo cleared.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clear failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell role="ADMIN">
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="mt-1 text-ink-800/70">
            Company branding and currency used across the app.
          </p>
        </div>

        <form onSubmit={onSubmit} className="card-panel max-w-xl space-y-4">
          <div>
            <label className="label" htmlFor="companyName">
              Company name
            </label>
            <input
              id="companyName"
              className="input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              maxLength={120}
            />
          </div>

          <div className="space-y-3">
            <p className="label">Company logo</p>
            <div>
              <label className="mb-1 block text-sm text-ink-800/70" htmlFor="logoUrl">
                Logo URL
              </label>
              <input
                id="logoUrl"
                className="input"
                type="url"
                placeholder="https://…"
                value={logoUrl.startsWith('/uploads/') ? '' : logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-800/55">
                Paste an external image URL, or upload a file below.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink-800/70" htmlFor="logoFile">
                Upload image
              </label>
              <input
                id="logoFile"
                className="input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={busy}
                onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-xs text-ink-800/55">
                PNG, JPEG, WebP, or GIF — max 2MB.
              </p>
            </div>
            {previewSrc || logoSrc ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSrc || logoSrc || ''}
                  alt="Logo preview"
                  className="h-14 w-14 rounded-lg border border-ink-800/10 object-cover"
                />
                <div className="space-y-1">
                  <p className="text-xs text-ink-800/60">Preview</p>
                  {(settings.logoUrl || logoUrl) && (
                    <button
                      type="button"
                      className="btn-ghost px-0 text-sm text-ember-500"
                      disabled={busy}
                      onClick={onClearLogo}
                    >
                      Clear logo
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <label className="label" htmlFor="currency">
              Currency
            </label>
            <select
              id="currency"
              className="input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="PHP">PHP — Philippine Peso</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
            </select>
            <p className="mt-2 text-sm text-ink-800/60">
              Example preview:{' '}
              {new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency,
              }).format(1299.5)}
            </p>
          </div>

          {error ? <p className="text-sm text-ember-500">{error}</p> : null}
          {saved ? <p className="text-sm text-moss-700">{saved}</p> : null}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
