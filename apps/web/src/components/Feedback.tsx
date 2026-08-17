'use client';

import { useEffect } from 'react';
import clsx from 'clsx';

function CheckIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 5.5 8.2 14.2 3.5 9.5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6.5v4.2M10 14.2h.01M3.6 16.2h12.8L10 3.8 3.6 16.2Z" />
    </svg>
  );
}

export function FlashBanner({
  kind,
  message,
  onDismiss,
}: {
  kind: 'success' | 'error';
  message: string;
  onDismiss: () => void;
}) {
  const success = kind === 'success';
  return (
    <div
      role={success ? 'status' : 'alert'}
      className={clsx(
        'flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-soft',
        success
          ? 'border-moss-500/30 bg-moss-500/10 text-moss-700'
          : 'border-ember-500/35 bg-ember-500/10 text-ember-500',
      )}
    >
      <span className="mt-0.5 shrink-0">{success ? <CheckIcon /> : <AlertIcon />}</span>
      <p className="min-w-0 flex-1 text-sm font-medium leading-5">{message}</p>
      <button
        type="button"
        className="shrink-0 rounded-md p-1 text-current/70 transition hover:bg-black/5 hover:text-current"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M5 5l10 10M15 5 5 15" />
        </svg>
      </button>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink-950/50"
        aria-label="Cancel"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="relative z-10 w-full max-w-md rounded-2xl border border-ink-800/10 bg-sand-50 p-6 shadow-soft"
      >
        <h2 id="confirm-title" className="font-display text-xl font-semibold text-ink-900">
          {title}
        </h2>
        <p id="confirm-body" className="mt-2 text-sm leading-6 text-ink-800/75">
          {body}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
