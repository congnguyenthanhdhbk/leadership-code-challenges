'use client';

import { Card } from '@/components/ui/Card';
import { CreateMemberForm } from './CreateMemberDialog';

// Shown by every page when there is no active member. Creating one from here makes it
// active, so the page re-renders into its real content.
export function NoMember({ reason }: { reason?: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <Card title="Start with a member" description={reason ?? 'Every operation acts on the active member and their wallet.'}>
        <ol className="flex flex-col gap-3 text-sm text-fg-muted">
          <Step n={1} title="Create a member">
            The API opens an empty wallet for them.
          </Step>
          <Step n={2} title="Create a deposit">
            It sits in <em>Pending</em> with a PSP reference. No money moves yet.
          </Step>
          <Step n={3} title="Send the PSP callback">
            A <em>completed</em> callback credits the wallet exactly once and adds a turnover requirement of amount × multiplier.
            Send it again and the API answers 200 with <code className="font-mono text-xs">applied=false</code>.
          </Step>
          <Step n={4} title="Place wagers">
            Each wager debits the balance and accrues turnover equal to its amount.
          </Step>
          <Step n={5} title="Withdraw">
            Allowed only once accrued turnover covers the requirement. Otherwise the API returns 422 with the outstanding figure.
          </Step>
        </ol>
      </Card>
      <Card>
        <CreateMemberForm />
      </Card>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{n}</span>
      <span>
        <span className="font-medium text-fg">{title}.</span> {children}
      </span>
    </li>
  );
}
