'use client';

import { useState } from 'react';
import { Badge, HttpBadge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Id } from '@/components/ui/CopyButton';
import { Empty } from '@/components/ui/Empty';
import { Money } from '@/components/ui/Money';
import { formatDateTime, formatTime } from '@/lib/format';
import { useOperationsStore, selectBusy } from '@/store/operationsStore';
import { useSessionStore } from '@/store/sessionStore';
import { useDepositsFor, type DepositRecord } from '@/store/transactionStore';

export function DepositList() {
  const memberId = useSessionStore((s) => s.activeMemberId);
  const deposits = useDepositsFor(memberId);

  return (
    <Card
      title="Deposits"
      description="Created from this browser for the active member. The API has no list endpoint, so this is the local record of each deposit and every callback delivery sent for it."
      padded={false}
    >
      {deposits.length === 0 ? (
        <div className="p-5">
          <Empty title="No deposits yet">Create one above. It will appear here with its PSP reference and settle buttons.</Empty>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {deposits.map((d) => (
            <DepositRow key={d.id} deposit={d} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function DepositRow({ deposit }: { deposit: DepositRecord }) {
  const [expanded, setExpanded] = useState(false);
  const sendCallback = useOperationsStore((s) => s.sendCallback);
  const sendBurst = useOperationsStore((s) => s.sendCallbackBurst);
  const busy = useOperationsStore(selectBusy('sendCallback'));
  const bursting = useOperationsStore(selectBusy('burst'));

  const pending = deposit.status === 'Pending';
  const disabled = busy || bursting;

  const complete = () => void sendCallback({ pspRef: deposit.pspRef, status: 'completed', amount: deposit.amount });
  const fail = () => void sendCallback({ pspRef: deposit.pspRef, status: 'failed', amount: deposit.amount });
  const replay = () =>
    void sendCallback({
      pspRef: deposit.pspRef,
      status: deposit.status === 'Failed' ? 'failed' : 'completed',
      amount: deposit.settledAmount ?? deposit.amount,
    });
  const conflict = () =>
    void sendCallback({
      pspRef: deposit.pspRef,
      status: deposit.status === 'Failed' ? 'completed' : 'failed',
      amount: deposit.amount,
    });
  const burst = () => void sendBurst({ pspRef: deposit.pspRef, status: 'completed', amount: deposit.amount, count: 5 });

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Money value={deposit.amount} className="text-base font-semibold" />
            <StatusBadge status={deposit.status} />
            <Badge tone="neutral">{deposit.turnoverMultiplier}× turnover</Badge>
            {deposit.amountMismatch ? (
              <Badge tone="warning" className="gap-1">
                settled <Money value={deposit.settledAmount} /> · mismatch
              </Badge>
            ) : deposit.status === 'Completed' && deposit.settledAmount ? (
              <Badge tone="success">
                settled <Money value={deposit.settledAmount} />
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
            <span>
              pspRef <Id value={deposit.pspRef} keep={13} />
            </span>
            <span>
              id <Id value={deposit.id} />
            </span>
            <span>{formatDateTime(deposit.createdAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pending ? (
            <>
              <Button size="sm" onClick={complete} disabled={disabled}>
                Complete
              </Button>
              <Button size="sm" variant="danger" onClick={fail} disabled={disabled}>
                Fail
              </Button>
              <Button size="sm" variant="secondary" onClick={burst} disabled={disabled} title="Send five identical completed callbacks at once">
                Complete ×5 concurrently
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={replay} disabled={disabled} title="Same outcome again: expect 200 applied=false">
                Replay callback
              </Button>
              <Button size="sm" variant="ghost" onClick={conflict} disabled={disabled} title="Opposite outcome: expect 409 invalid_transition">
                Send conflicting
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {deposit.callbacks.length} {deposit.callbacks.length === 1 ? 'delivery' : 'deliveries'} {expanded ? '▴' : '▾'}
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 overflow-x-auto rounded-md border border-border">
          {deposit.callbacks.length === 0 ? (
            <p className="px-3 py-2 text-xs text-fg-subtle">No callback has been sent for this deposit yet.</p>
          ) : (
            <table className="w-full min-w-[520px] text-xs">
              <thead className="bg-surface-muted text-left text-fg-subtle">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Sent</th>
                  <th className="px-3 py-1.5 font-medium">Requested</th>
                  <th className="px-3 py-1.5 font-medium">Amount</th>
                  <th className="px-3 py-1.5 font-medium">HTTP</th>
                  <th className="px-3 py-1.5 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deposit.callbacks.map((c) => (
                  <tr key={c.id}>
                    <td className="tabular px-3 py-1.5 text-fg-muted">{formatTime(c.sentAt)}</td>
                    <td className="px-3 py-1.5 font-mono">{c.requestedStatus}</td>
                    <td className="px-3 py-1.5">
                      <Money value={c.requestedAmount} />
                    </td>
                    <td className="px-3 py-1.5">
                      <HttpBadge status={c.httpStatus} />
                    </td>
                    <td className="px-3 py-1.5">
                      {c.applied === true ? (
                        <Badge tone="success">applied</Badge>
                      ) : c.applied === false ? (
                        <Badge tone="info">duplicate · applied=false</Badge>
                      ) : (
                        <Badge tone="danger" mono>
                          {c.errorCode ?? 'error'}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </li>
  );
}
