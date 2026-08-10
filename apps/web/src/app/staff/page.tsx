'use client';

import { AppShell } from '@/components/AppShell';
import { StaffDashboardView } from '@/components/DashboardViews';

export default function Page() {
  return (
    <AppShell role="STAFF">
      <StaffDashboardView />
    </AppShell>
  );
}
