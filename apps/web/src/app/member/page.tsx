'use client';

import { AppShell } from '@/components/AppShell';
import { MemberDashboardView } from '@/components/DashboardViews';

export default function Page() {
  return (
    <AppShell role="MEMBER">
      <MemberDashboardView />
    </AppShell>
  );
}
