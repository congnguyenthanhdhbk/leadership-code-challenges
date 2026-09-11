'use client';

import { useHealthStore } from '@/store/healthStore';
import { formatTime } from '@/lib/format';

export function HealthBadge() {
  const { status, lastCheckedAt, lastError, check } = useHealthStore();

  const dot =
    status === 'ok' ? 'bg-success' : status === 'down' ? 'bg-danger' : status === 'checking' ? 'bg-warning animate-pulse' : 'bg-fg-subtle';
  const label = status === 'ok' ? 'API online' : status === 'down' ? 'API unreachable' : status === 'checking' ? 'Checking API' : 'API status unknown';

  return (
    <button
      type="button"
      onClick={() => void check()}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-fg-muted hover:bg-surface-muted"
      title={lastError ?? (lastCheckedAt ? `Last checked ${formatTime(lastCheckedAt)}` : 'Click to check')}
    >
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      <span className="flex flex-col leading-tight">
        <span className="font-medium text-fg">{label}</span>
        <span className="text-[11px] text-fg-subtle">{lastCheckedAt ? `checked ${formatTime(lastCheckedAt)}` : 'click to check'}</span>
      </span>
    </button>
  );
}
