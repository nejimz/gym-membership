'use client';

import { useEffect } from 'react';
import { useSettings } from '@/lib/settings';

const DEFAULT_FAVICON = '/favicon.ico';

export function DocumentFavicon() {
  const { faviconSrc } = useSettings();

  useEffect(() => {
    const href = faviconSrc || DEFAULT_FAVICON;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    // Bust cache when favicon changes
    link.href = href.includes('?') ? href : `${href}?v=${encodeURIComponent(href)}`;
    if (href.includes('.ico')) {
      link.type = 'image/x-icon';
    } else {
      link.removeAttribute('type');
    }
  }, [faviconSrc]);

  return null;
}
