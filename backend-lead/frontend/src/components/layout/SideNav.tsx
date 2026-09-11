'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useActivityStore } from '@/store/activityStore';
import { useHydrated } from '@/store/persist';

const items: { href: string; label: string; hint: string }[] = [
  { href: '/', label: 'Overview', hint: 'Wallet and turnover' },
  { href: '/deposits', label: 'Deposits', hint: 'Create and settle via PSP' },
  { href: '/wagers', label: 'Wagers', hint: 'Debit and accrue turnover' },
  { href: '/withdrawals', label: 'Withdrawals', hint: 'Turnover-gated payouts' },
  { href: '/activity', label: 'Activity', hint: 'Every API round trip' },
];

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const hydrated = useHydrated(useActivityStore);
  const activityCount = useActivityStore((s) => s.entries.length);

  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {items.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
              active ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
            }`}
          >
            <span className="flex flex-col leading-tight">
              <span className="font-medium">{item.label}</span>
              <span className={`text-[11px] ${active ? 'text-accent/80' : 'text-fg-subtle'}`}>{item.hint}</span>
            </span>
            {item.href === '/activity' && hydrated && activityCount > 0 ? (
              <span className="tabular rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-fg-muted">{activityCount}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
