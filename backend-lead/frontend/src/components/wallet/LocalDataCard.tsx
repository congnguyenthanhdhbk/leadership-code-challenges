'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useActivityStore } from '@/store/activityStore';
import { useSessionStore, selectActiveMember } from '@/store/sessionStore';
import { useTransactionStore } from '@/store/transactionStore';
import { toast } from '@/store/toastStore';

// Everything this console remembers lives in localStorage. Forgetting it here never
// touches the API's database.
export function LocalDataCard() {
  const [confirm, setConfirm] = useState<'member' | 'all' | null>(null);
  const member = useSessionStore(selectActiveMember);
  const memberCount = useSessionStore((s) => s.members.length);
  const removeMember = useSessionStore((s) => s.removeMember);
  const resetSession = useSessionStore((s) => s.reset);
  const removeForMember = useTransactionStore((s) => s.removeForMember);
  const resetTransactions = useTransactionStore((s) => s.reset);
  const resetActivity = useActivityStore((s) => s.clear);

  const forgetMember = () => {
    if (!member) return;
    removeForMember(member.id);
    removeMember(member.id);
    setConfirm(null);
    toast.info(`Forgot ${member.username} locally`, 'The member and wallet still exist in the API. Note the id if you want to come back to it.');
  };

  const forgetAll = () => {
    resetTransactions();
    resetActivity();
    resetSession();
    setConfirm(null);
    toast.info('Local data cleared', 'Members, transactions and activity were removed from this browser only.');
  };

  return (
    <Card title="Local data" description="Members, deposits, wagers and the activity feed are remembered in this browser only. The API keeps its own records.">
      <div className="flex flex-col gap-3 text-xs text-fg-muted">
        <p>
          {memberCount} {memberCount === 1 ? 'member' : 'members'} remembered.
        </p>
        {confirm ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2">
            <span className="text-warning">
              {confirm === 'member' ? `Forget ${member?.username} and their local history?` : 'Forget every member, transaction and log entry?'}
            </span>
            <Button size="sm" variant="danger" onClick={confirm === 'member' ? forgetMember : forgetAll}>
              Yes, forget
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={!member} onClick={() => setConfirm('member')}>
              Forget active member
            </Button>
            <Button size="sm" variant="ghost" disabled={memberCount === 0} onClick={() => setConfirm('all')}>
              Forget everything
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
