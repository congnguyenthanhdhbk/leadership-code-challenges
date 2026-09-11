'use client';

import { useEffect, useRef } from 'react';
import { useSessionStore, selectActiveMember } from '@/store/sessionStore';
import { useHydrated } from '@/store/persist';
import { useOperationsStore } from '@/store/operationsStore';
import { Select } from '@/components/ui/Field';
import { CreateMemberDialog } from './CreateMemberDialog';

// Header control: pick the member every page acts on. Switching triggers a wallet
// refresh so the overview never shows a stale snapshot for the new selection.
export function MemberSwitcher() {
  const hydrated = useHydrated(useSessionStore);
  const members = useSessionStore((s) => s.members);
  const active = useSessionStore(selectActiveMember);
  const setActive = useSessionStore((s) => s.setActiveMember);
  const refreshWallet = useOperationsStore((s) => s.refreshWallet);
  const lastRefreshed = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated || !active) return;
    if (lastRefreshed.current === active.id) return;
    lastRefreshed.current = active.id;
    void refreshWallet(active.id);
  }, [hydrated, active, refreshWallet]);

  if (!hydrated) {
    return <div className="h-10 w-56 animate-pulse rounded-md bg-surface-muted" aria-hidden="true" />;
  }

  return (
    <div className="flex items-center gap-2">
      {members.length > 0 ? (
        <Select
          aria-label="Active member"
          value={active?.id ?? ''}
          onChange={(e) => setActive(e.target.value || null)}
          className="w-56"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.username}
            </option>
          ))}
        </Select>
      ) : (
        <span className="text-xs text-fg-subtle">No members yet</span>
      )}
      <CreateMemberDialog />
    </div>
  );
}
