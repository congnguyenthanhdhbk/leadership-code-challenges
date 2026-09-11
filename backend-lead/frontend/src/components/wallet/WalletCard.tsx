'use client';

import { Button } from '@/components/ui/Button';
import { Card, Stat } from '@/components/ui/Card';
import { Id } from '@/components/ui/CopyButton';
import { Money } from '@/components/ui/Money';
import { formatTime } from '@/lib/format';
import { compare, outstandingTurnover } from '@/lib/money';
import { useOperationsStore, selectBusy } from '@/store/operationsStore';
import { useSessionStore, selectActiveMember, selectActiveWallet } from '@/store/sessionStore';
import { TurnoverGauge } from './TurnoverGauge';

export function WalletCard() {
  const member = useSessionStore(selectActiveMember);
  const wallet = useSessionStore(selectActiveWallet);
  const refreshWallet = useOperationsStore((s) => s.refreshWallet);
  const refreshing = useOperationsStore(selectBusy('refreshWallet'));

  if (!member) return null;

  const met = wallet ? compare(wallet.turnoverAccrued, wallet.turnoverRequired) >= 0 : false;
  const outstanding = wallet ? outstandingTurnover(wallet.turnoverRequired, wallet.turnoverAccrued) : '0';

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span>{member.username}</span>
          <span className="text-xs font-normal text-fg-subtle">wallet</span>
        </span>
      }
      description={
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            member <Id value={member.id} />
          </span>
          <span>
            wallet <Id value={member.walletId} />
          </span>
        </span>
      }
      actions={
        <>
          {wallet ? <span className="text-xs text-fg-subtle">as of {formatTime(wallet.fetchedAt)}</span> : null}
          <Button variant="secondary" size="sm" loading={refreshing} onClick={() => void refreshWallet(member.id)}>
            Refresh
          </Button>
        </>
      }
    >
      {wallet ? (
        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <div className="grid grid-cols-2 gap-6">
            <Stat label="Balance" value={<Money value={wallet.balance} />} />
            <Stat
              label="Withdrawals"
              value={met ? 'Unlocked' : 'Locked'}
              tone={met ? 'success' : 'warning'}
              sub={met ? 'Turnover requirement is covered.' : <>Wager <Money value={outstanding} /> more to unlock.</>}
            />
            <Stat label="Turnover required" value={<Money value={wallet.turnoverRequired} />} sub="Σ deposit × multiplier" />
            <Stat label="Turnover accrued" value={<Money value={wallet.turnoverAccrued} />} sub="Σ wagers" />
          </div>
          <div className="flex flex-col justify-center rounded-md border border-border bg-surface-muted/60 p-4">
            <TurnoverGauge required={wallet.turnoverRequired} accrued={wallet.turnoverAccrued} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-fg-muted">Loading wallet…</p>
      )}
    </Card>
  );
}
