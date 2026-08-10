'use client';

import { AppShell } from '@/components/AppShell';
import { MembersPage } from '@/components/MembersPage';

export default function Page() {
  return (
    <AppShell role="ADMIN">
      <MembersPage basePath="/admin" />
    </AppShell>
  );
}
