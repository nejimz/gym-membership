'use client';

import { AppShell } from '@/components/AppShell';
import { AttendanceDesk } from '@/components/AttendanceDesk';

export default function Page() {
  return (
    <AppShell role="STAFF">
      <AttendanceDesk />
    </AppShell>
  );
}
