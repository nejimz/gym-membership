'use client';

import { AppShell } from '@/components/AppShell';
import { AccountPage } from '@/components/AccountPage';

export default function Page() {
  return (
    <AppShell role="MEMBER">
      <AccountPage />
    </AppShell>
  );
}
