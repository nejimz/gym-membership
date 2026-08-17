'use client';

import { AppShell } from '@/components/AppShell';
import { PlansPage } from '@/components/PlansPage';

export default function Page() {
  return (
    <AppShell role="ADMIN">
      <PlansPage />
    </AppShell>
  );
}
