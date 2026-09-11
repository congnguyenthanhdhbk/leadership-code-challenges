'use client';

import type { ReactNode } from 'react';
import { useHydrated } from '@/store/persist';
import { useSessionStore } from '@/store/sessionStore';
import { useTransactionStore } from '@/store/transactionStore';
import { useActivityStore } from '@/store/activityStore';

// Renders a skeleton until the persisted stores have loaded from localStorage, so pages
// never flash an empty state on a returning visit.
export function HydrationGate({ children }: { children: ReactNode }) {
  const hydrated = useHydrated(useSessionStore, useTransactionStore, useActivityStore);
  if (!hydrated) return <PageSkeleton />;
  return <>{children}</>;
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="h-7 w-48 animate-pulse rounded bg-surface-muted" />
      <div className="h-40 animate-pulse rounded-lg bg-surface-muted" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-56 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-56 animate-pulse rounded-lg bg-surface-muted" />
      </div>
    </div>
  );
}
