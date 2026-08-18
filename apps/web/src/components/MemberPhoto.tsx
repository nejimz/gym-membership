'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { resolveAssetUrl } from '@/lib/settings';

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-14 w-14 text-lg',
  lg: 'h-24 w-24 text-2xl',
} as const;

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`;
  return letters.toUpperCase() || '?';
}

function Initials({
  name,
  size,
  className,
}: {
  name: string;
  size: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-moss-600 font-semibold uppercase text-white',
        SIZES[size],
        className,
      )}
    >
      {initialsFromName(name)}
    </span>
  );
}

export function MemberPhoto({
  url,
  name,
  size = 'md',
  className,
}: {
  url?: string | null;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const src = resolveAssetUrl(url);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <Initials name={name} size={size} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={clsx(
        'shrink-0 rounded-full border border-ink-800/10 bg-sand-100 object-cover',
        SIZES[size],
        className,
      )}
      onError={() => setFailed(true)}
    />
  );
}
