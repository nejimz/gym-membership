'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type AppSettings = {
  id: string;
  companyName: string;
  logoUrl: string | null;
  currency: string;
};

type SettingsContextValue = {
  settings: AppSettings;
  loading: boolean;
  refresh: () => Promise<void>;
  formatMoney: (amount: number | string) => string;
  logoSrc: string | null;
  resolveAssetUrl: (url: string | null | undefined) => string | null;
};

const defaults: AppSettings = {
  id: 'default',
  companyName: 'Ironleaf Gym',
  logoUrl: null,
  currency: 'PHP',
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/')) {
    return `${API_URL.replace(/\/$/, '')}${url}`;
  }
  return url;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaults);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<AppSettings>('/settings');
      setSettings(data);
    } catch {
      setSettings(defaults);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const formatMoney = useCallback(
    (amount: number | string) => {
      const value = typeof amount === 'string' ? Number(amount) : amount;
      if (Number.isNaN(value)) return String(amount);
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: settings.currency || 'PHP',
        }).format(value);
      } catch {
        return `${settings.currency} ${value.toFixed(2)}`;
      }
    },
    [settings.currency],
  );

  const logoSrc = useMemo(
    () => resolveAssetUrl(settings.logoUrl),
    [settings.logoUrl],
  );

  const value = useMemo(
    () => ({
      settings,
      loading,
      refresh,
      formatMoney,
      logoSrc,
      resolveAssetUrl,
    }),
    [settings, loading, refresh, formatMoney, logoSrc],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
