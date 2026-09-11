'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { NoMember } from '@/components/members/NoMember';
import { HydrationGate } from '@/components/providers/HydrationGate';
import { WagerForm } from '@/components/wagers/WagerForm';
import { WagerList } from '@/components/wagers/WagerList';
import { WalletCard } from '@/components/wallet/WalletCard';
import { useSessionStore } from '@/store/sessionStore';

export default function WagersPage() {
  return (
    <HydrationGate>
      <Wagers />
    </HydrationGate>
  );
}

function Wagers() {
  const memberId = useSessionStore((s) => s.activeMemberId);

  return (
    <>
      <PageHeader title="Wagers" description="Each stake debits the wallet and accrues the same amount of turnover, moving the member towards unlocking withdrawals." />
      {memberId ? (
        <div className="flex flex-col gap-4">
          <WalletCard />
          <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
            <WagerForm />
            <WagerList />
          </div>
        </div>
      ) : (
        <NoMember reason="Wagers are placed against the active member's wallet." />
      )}
    </>
  );
}
