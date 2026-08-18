'use client';

import { AppShell } from '@/components/AppShell';
import { ReportsPage } from '@/components/ReportsPage';

export default function Page() {
  return (
    <AppShell role="ADMIN">
      <ReportsPage />
    </AppShell>
  );
}
