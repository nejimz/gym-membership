'use client';

import { AppShell } from '@/components/AppShell';
import { UsersPage } from '@/components/UsersPage';

export default function Page() {
  return (
    <AppShell role="ADMIN">
      <UsersPage />
    </AppShell>
  );
}
