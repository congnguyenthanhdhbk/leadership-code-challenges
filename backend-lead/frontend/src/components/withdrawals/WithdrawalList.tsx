'use client';

import { StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Id } from '@/components/ui/CopyButton';
import { Empty } from '@/components/ui/Empty';
import { Money } from '@/components/ui/Money';
import { formatDateTime } from '@/lib/format';
import { useSessionStore } from '@/store/sessionStore';
import { useWithdrawalsFor } from '@/store/transactionStore';

export function WithdrawalList() {
  const memberId = useSessionStore((s) => s.activeMemberId);
  const withdrawals = useWithdrawalsFor(memberId);

  return (
    <Card title="Pending payouts" description="Withdrawals the API accepted. Each debited the wallet immediately and awaits approval, which is out of scope for the service." padded={false}>
      {withdrawals.length === 0 ? (
        <div className="p-5">
          <Empty title="No withdrawals yet">Accepted withdrawals appear here. Blocked ones only show in the activity feed.</Empty>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {withdrawals.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Money value={w.amount} className="text-base font-semibold" />
                  <StatusBadge status={w.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 text-xs text-fg-subtle">
                  <span>
                    payout <Id value={w.id} />
                  </span>
                  <span>{formatDateTime(w.createdAt)}</span>
                </div>
              </div>
              <div className="text-right text-xs text-fg-muted">
                balance after <Money value={w.balanceAfter} className="text-fg" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
