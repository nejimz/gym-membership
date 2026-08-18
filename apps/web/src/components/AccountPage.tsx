'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ConfirmDialog, FlashBanner } from '@/components/Feedback';
import { MemberPhoto } from '@/components/MemberPhoto';

type Sex = 'MALE' | 'FEMALE';

type MemberProfile = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  emergencyContact?: string | null;
  heightCm?: number | null;
  sex?: Sex | null;
  photoUrl?: string | null;
};

export function AccountPage() {
  const { user, refresh } = useAuth();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<'profile' | 'password' | 'photo' | null>(null);
  const [confirmProfile, setConfirmProfile] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const isMember = Boolean(user?.memberId);

  useEffect(() => {
    if (!user?.memberId) return;
    let cancelled = false;
    api<MemberProfile>('/members/me')
      .then((m) => {
        if (cancelled) return;
        setFirstName(m.firstName);
        setLastName(m.lastName);
        setPhone(m.phone ?? '');
        setEmergencyContact(m.emergencyContact ?? '');
        setHeightCm(m.heightCm != null ? String(m.heightCm) : '');
        setSex(m.sex ?? '');
        setPhotoUrl(m.photoUrl ?? null);
      })
      .catch((e) => {
        if (!cancelled) {
          setNotice('');
          setError(e instanceof Error ? e.message : 'Failed to load profile');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.memberId]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function requestSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (heightCm.trim()) {
      const height = Number(heightCm);
      if (!Number.isFinite(height) || height < 0) {
        setNotice('');
        setError('Height must be a valid number of centimeters.');
        return;
      }
    }
    setConfirmProfile(true);
  }

  async function onUploadPhoto(file: File | null) {
    if (!file || !user?.memberId || busy) return;
    const typeOk =
      file.type.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    if (!typeOk) {
      setNotice('');
      setError('Choose a PNG, JPEG, WebP, or GIF image.');
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice('');
      setError('Photo must be 5MB or smaller.');
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }
    try {
      setBusy('photo');
      setError('');
      setNotice('');
      const form = new FormData();
      form.append('photo', file);
      const updated = await api<MemberProfile>(`/members/${user.memberId}/photo`, {
        method: 'POST',
        body: form,
      });
      setPhotoUrl(updated.photoUrl ?? null);
      await refresh();
      setNotice('Profile photo updated.');
    } catch (err) {
      setNotice('');
      setError(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setBusy(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  async function onClearPhoto() {
    if (!user?.memberId || busy || !photoUrl) return;
    try {
      setBusy('photo');
      setError('');
      setNotice('');
      await api(`/members/${user.memberId}/photo`, { method: 'DELETE' });
      setPhotoUrl(null);
      await refresh();
      setNotice('Profile photo removed.');
    } catch (err) {
      setNotice('');
      setError(err instanceof Error ? err.message : 'Failed to remove photo');
    } finally {
      setBusy(null);
    }
  }

  async function saveProfile() {
    if (!user?.memberId || busy) return;
    try {
      setBusy('profile');
      setConfirmProfile(false);
      setError('');
      setNotice('');
      await api(`/members/${user.memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
          emergencyContact: emergencyContact.trim() || null,
          heightCm: heightCm.trim() ? Number(heightCm) : null,
          sex: sex || null,
        }),
      });
      await refresh();
      setNotice('Profile saved.');
    } catch (err) {
      setNotice('');
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setBusy(null);
    }
  }

  async function onSubmitPassword(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from the current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setBusy('password');
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice('Password updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Account</h1>
        <p className="mt-1 text-ink-800/70">
          {isMember
            ? 'Update your profile and sign-in password.'
            : 'Change your sign-in password.'}
        </p>
      </div>

      {error ? (
        <FlashBanner kind="error" message={error} onDismiss={() => setError('')} />
      ) : null}
      {notice ? (
        <FlashBanner kind="success" message={notice} onDismiss={() => setNotice('')} />
      ) : null}

      {isMember ? (
        <div className="card-panel max-w-xl space-y-4">
          <h2 className="font-display text-xl font-semibold">Your profile</h2>
          <div className="flex flex-wrap items-center gap-4">
            <MemberPhoto
              url={photoUrl}
              name={`${firstName} ${lastName}`.trim() || user?.name || user?.email || 'Member'}
              size="lg"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <label className="label" htmlFor="account-photo">
                Profile picture
              </label>
              <input
                id="account-photo"
                ref={photoInputRef}
                className="input"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
                disabled={busy != null}
                onChange={(e) => onUploadPhoto(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs text-ink-800/55">
                  {busy === 'photo'
                    ? 'Uploading…'
                    : 'PNG, JPEG, WebP, or GIF — max 5MB.'}
                </p>
                {photoUrl ? (
                  <button
                    type="button"
                    className="btn-ghost px-0 text-sm text-ember-500"
                    disabled={busy != null}
                    onClick={() => void onClearPhoto()}
                  >
                    Remove photo
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <form onSubmit={requestSaveProfile} className="space-y-4 border-t border-ink-800/10 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="account-first-name">
                First name
              </label>
              <input
                id="account-first-name"
                className="input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="account-last-name">
                Last name
              </label>
              <input
                id="account-last-name"
                className="input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="account-phone">
                Phone
              </label>
              <input
                id="account-phone"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="account-emergency">
                Emergency contact
              </label>
              <input
                id="account-emergency"
                className="input"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Name and phone"
              />
            </div>
            <div>
              <label className="label" htmlFor="account-height">
                Height (cm)
              </label>
              <input
                id="account-height"
                className="input"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="label" htmlFor="account-sex">
                Sex
              </label>
              <select
                id="account-sex"
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
          <button type="submit" className="btn-primary" disabled={busy != null}>
            {busy === 'profile' ? 'Saving…' : 'Save profile'}
          </button>
          </form>
        </div>
      ) : null}

      <form onSubmit={onSubmitPassword} className="card-panel max-w-xl space-y-4">
        <h2 className="font-display text-xl font-semibold">Password</h2>
        <div>
          <label className="label" htmlFor="currentPassword">
            Current password
          </label>
          <input
            id="currentPassword"
            className="input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="label" htmlFor="newPassword">
            New password
          </label>
          <input
            id="newPassword"
            className="input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="label" htmlFor="confirmPassword">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={busy != null}>
          {busy === 'password' ? 'Updating…' : 'Update password'}
        </button>
      </form>

      {confirmProfile ? (
        <ConfirmDialog
          title="Save profile?"
          body="Update your name, phone, emergency contact, and body profile."
          confirmLabel="Save"
          onCancel={() => setConfirmProfile(false)}
          onConfirm={() => void saveProfile()}
        />
      ) : null}
    </div>
  );
}
