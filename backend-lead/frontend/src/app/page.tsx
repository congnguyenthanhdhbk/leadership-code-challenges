'use client';

import Link from 'next/link';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { PageHeader } from '@/components/layout/PageHeader';
import { NoMember } from '@/components/members/NoMember';
import { HydrationGate } from '@/components/providers/HydrationGate';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { LocalDataCard } from '@/components/wallet/LocalDataCard';
import { WalletCard } from '@/components/wallet/WalletCard';
import { useSessionStore, selectActiveMember } from '@/store/sessionStore';
import { useDepositsFor, useWagersFor, useWithdrawalsFor } from '@/store/transactionStore';

export default function OverviewPage() {
  return (
    <HydrationGate>
      <Overview />
    </HydrationGate>
  );
}

function Overview() {
  const member = useSessionStore(selectActiveMember);
  const deposits = useDepositsFor(member?.id ?? null);
  const wagers = useWagersFor(member?.id ?? null);
  const withdrawals = useWithdrawalsFor(member?.id ?? null);

  if (!member) {
    return (
      <>
        <PageHeader title="Overview" description="A console for the mini wallet service: deposit, settle through the PSP callback, wager, and withdraw behind the turnover lock." />
        <NoMember />
      </>
    );
  }

  const pending = deposits.filter((d) => d.status === 'Pending').length;
  const completed = deposits.filter((d) => d.status === 'Completed').length;
  const failed = deposits.filter((d) => d.status === 'Failed').length;

  return (
    <>
      <PageHeader title="Overview" description="Live wallet state for the active member, read from the API, next to what this console has done for them." />
      <div className="flex flex-col gap-4">
        <WalletCard />

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            href="/deposits"
            title="Deposits"
            primary={`${deposits.length}`}
            rows={[
              ['Pending', pending],
              ['Completed', completed],
              ['Failed', failed],
            ]}
            cta={pending > 0 ? `${pending} awaiting a PSP callback` : 'Create and settle deposits'}
          />
          <SummaryCard
            href="/wagers"
            title="Wagers"
            primary={`${wagers.length}`}
            rows={[['Last stake', wagers[0] ? <Money value={wagers[0].amount} /> : '—']]}
            cta="Debit and accrue turnover"
          />
          <SummaryCard
            href="/withdrawals"
            title="Withdrawals"
            primary={`${withdrawals.length}`}
            rows={[['Last payout', withdrawals[0] ? <Money value={withdrawals[0].amount} /> : '—']]}
            cta="Request a turnover-gated payout"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <ActivityFeed limit={8} compact />
          <LocalDataCard />
        </div>
      </div>
    </>
  );
}

function SummaryCard({
  href,
  title,
  primary,
  rows,
  cta,
}: {
  href: string;
  title: string;
  primary: string;
  rows: [string, React.ReactNode][];
  cta: string;
}) {
  return (
    <Card className="flex flex-col" padded={false}>
      <Link href={href} className="flex h-full flex-col justify-between gap-3 rounded-lg p-5 transition-colors hover:bg-surface-muted/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{title}</p>
            <p className="tabular mt-1 text-3xl font-semibold text-fg">{primary}</p>
          </div>
          <dl className="flex flex-col gap-0.5 text-right text-xs text-fg-muted">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-end gap-2">
                <dt>{k}</dt>
                <dd className="tabular font-medium text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="text-xs font-medium text-accent">{cta} →</p>
      </Link>
    </Card>
  );
}
