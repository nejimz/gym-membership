'use client';

import { AppShell } from '@/components/AppShell';
import { StaffDashboardView } from '@/components/DashboardViews';

export default function AdminHome() {
  return (
    <AppShell role="ADMIN">
      <StaffDashboardView />
    </AppShell>
  );
}
