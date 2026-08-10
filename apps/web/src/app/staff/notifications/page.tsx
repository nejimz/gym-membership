'use client';

import { AppShell } from '@/components/AppShell';
import { NotificationsPage } from '@/components/NotificationsPage';

export default function Page() {
  return (
    <AppShell role="STAFF">
      <NotificationsPage />
    </AppShell>
  );
}
