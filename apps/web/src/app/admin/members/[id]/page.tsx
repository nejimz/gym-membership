'use client';

import { use } from 'react';
import { AppShell } from '@/components/AppShell';
import { MemberDetailPage } from '@/components/MemberDetailPage';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell role="ADMIN">
      <MemberDetailPage memberId={id} canEditPlan />
    </AppShell>
  );
}
