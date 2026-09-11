'use client';

import { useState, type ReactNode } from 'react';
import { HealthBadge } from './HealthBadge';
import { SideNav } from './SideNav';
import { MemberSwitcher } from '@/components/members/MemberSwitcher';

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-full lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-border bg-surface lg:flex lg:flex-col">
        <Brand />
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SideNav />
        </div>
        <div className="border-t border-border p-3">
          <HealthBadge />
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-md p-2 text-fg-muted hover:bg-surface-muted lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden="true">
              <path d="M3 5.75A.75.75 0 0 1 3.75 5h12.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 5.75Zm0 4.25a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 10Zm.75 3.5a.75.75 0 0 0 0 1.5h12.5a.75.75 0 0 0 0-1.5H3.75Z" />
            </svg>
          </button>
          <div className="lg:hidden">
            <Brand compact />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden lg:block">
              <MemberSwitcher />
            </div>
          </div>
        </header>

        {open ? (
          <div className="border-b border-border bg-surface px-3 py-3 lg:hidden">
            <div className="mb-3">
              <MemberSwitcher />
            </div>
            <SideNav onNavigate={() => setOpen(false)} />
            <div className="mt-3 border-t border-border pt-3">
              <HealthBadge />
            </div>
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${compact ? '' : 'border-b border-border px-5 py-4'}`}>
      <span className="grid size-8 place-items-center rounded-md bg-accent text-sm font-bold text-white" aria-hidden="true">
        W
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-fg">Mini Wallet</span>
        {compact ? null : <span className="text-[11px] text-fg-subtle">operator console</span>}
      </span>
    </div>
  );
}
