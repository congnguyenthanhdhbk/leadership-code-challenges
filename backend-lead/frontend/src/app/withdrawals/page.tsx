'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { NoMember } from '@/components/members/NoMember';
import { HydrationGate } from '@/components/providers/HydrationGate';
import { WalletCard } from '@/components/wallet/WalletCard';
import { WithdrawalForm } from '@/components/withdrawals/WithdrawalForm';
import { WithdrawalList } from '@/components/withdrawals/WithdrawalList';
import { useSessionStore } from '@/store/sessionStore';

export default function WithdrawalsPage() {
  return (
    <HydrationGate>
      <Withdrawals />
    </HydrationGate>
  );
}

function Withdrawals() {
  const memberId = useSessionStore((s) => s.activeMemberId);

  return (
    <>
      <PageHeader
        title="Withdrawals"
        description="The anti-abuse control: a member may only withdraw once accrued turnover covers the total requirement from their completed deposits."
      />
      {memberId ? (
        <div className="flex flex-col gap-4">
          <WalletCard />
          <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
            <WithdrawalForm />
            <WithdrawalList />
          </div>
        </div>
      ) : (
        <NoMember reason="Withdrawals are requested for the active member." />
      )}
    </>
  );
}
