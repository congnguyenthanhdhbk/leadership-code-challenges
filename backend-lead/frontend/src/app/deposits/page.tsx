'use client';

import { CallbackForm } from '@/components/deposits/CallbackForm';
import { DepositForm } from '@/components/deposits/DepositForm';
import { DepositList } from '@/components/deposits/DepositList';
import { PageHeader } from '@/components/layout/PageHeader';
import { NoMember } from '@/components/members/NoMember';
import { HydrationGate } from '@/components/providers/HydrationGate';
import { useSessionStore } from '@/store/sessionStore';

export default function DepositsPage() {
  return (
    <HydrationGate>
      <Deposits />
    </HydrationGate>
  );
}

function Deposits() {
  const memberId = useSessionStore((s) => s.activeMemberId);

  return (
    <>
      <PageHeader
        title="Deposits"
        description="Two steps, as in production: create the funding transaction, then let the PSP report the outcome. Duplicate and concurrent callbacks are safe to send."
      />
      {memberId ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <DepositForm />
            <CallbackForm />
          </div>
          <DepositList />
        </div>
      ) : (
        <NoMember reason="Deposits are created for the active member's wallet." />
      )}
    </>
  );
}
