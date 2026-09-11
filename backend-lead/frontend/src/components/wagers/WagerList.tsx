'use client';

import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Money } from '@/components/ui/Money';
import { formatDateTime } from '@/lib/format';
import { useSessionStore } from '@/store/sessionStore';
import { useWagersFor } from '@/store/transactionStore';

export function WagerList() {
  const memberId = useSessionStore((s) => s.activeMemberId);
  const wagers = useWagersFor(memberId);

  return (
    <Card title="Accepted wagers" description="Wagers the API accepted for the active member, newest first, with the balance and accrued turnover it reported." padded={false}>
      {wagers.length === 0 ? (
        <div className="p-5">
          <Empty title="No wagers yet">Accepted wagers appear here. Rejected ones only show in the activity feed.</Empty>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-surface-muted text-left text-xs text-fg-subtle">
              <tr>
                <th className="px-5 py-2 font-medium">When</th>
                <th className="px-5 py-2 text-right font-medium">Stake</th>
                <th className="px-5 py-2 text-right font-medium">Balance after</th>
                <th className="px-5 py-2 text-right font-medium">Turnover accrued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {wagers.map((w) => (
                <tr key={w.id}>
                  <td className="tabular px-5 py-2 text-xs text-fg-muted">{formatDateTime(w.createdAt)}</td>
                  <td className="px-5 py-2 text-right">
                    <Money value={w.amount} className="text-danger" />
                  </td>
                  <td className="px-5 py-2 text-right">
                    <Money value={w.balanceAfter} />
                  </td>
                  <td className="px-5 py-2 text-right">
                    <Money value={w.turnoverAccruedAfter} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
