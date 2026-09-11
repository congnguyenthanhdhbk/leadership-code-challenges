'use client';

import { useMemo, useState } from 'react';
import { Badge, HttpBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input, Select } from '@/components/ui/Field';
import { formatDuration, formatTime } from '@/lib/format';
import { useActivityStore, type ActivityEntry } from '@/store/activityStore';

type Filter = 'all' | 'ok' | 'error';

export function ActivityFeed({ limit, compact = false }: { limit?: number; compact?: boolean }) {
  const entries = useActivityStore((s) => s.entries);
  const clear = useActivityStore((s) => s.clear);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = entries.filter((e) => {
      if (filter === 'ok' && !e.ok) return false;
      if (filter === 'error' && e.ok) return false;
      if (q && !`${e.method} ${e.path} ${JSON.stringify(e.responseBody ?? '')}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return limit ? filtered.slice(0, limit) : filtered;
  }, [entries, filter, query, limit]);

  return (
    <Card
      title={compact ? 'Recent API activity' : 'API activity'}
      description={compact ? undefined : 'Every request this browser sent to the wallet API and the exact response. Newest first, kept locally, capped at 300.'}
      padded={false}
      actions={
        compact ? null : (
          <>
            <Input aria-label="Search activity" placeholder="Search path or response…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 w-52 text-xs" />
            <Select aria-label="Filter by outcome" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="h-8 w-28 text-xs">
              <option value="all">All</option>
              <option value="ok">2xx only</option>
              <option value="error">Errors only</option>
            </Select>
            <Button variant="ghost" size="sm" onClick={clear} disabled={entries.length === 0}>
              Clear
            </Button>
          </>
        )
      }
    >
      {visible.length === 0 ? (
        <div className="p-5">
          <Empty title={entries.length === 0 ? 'No requests yet' : 'Nothing matches'}>
            {entries.length === 0 ? 'Create a member or a deposit and the round trip shows up here.' : 'Adjust the filter or search.'}
          </Empty>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((e) => (
            <ActivityRow key={e.id} entry={e} compact={compact} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ActivityRow({ entry, compact }: { entry: ActivityEntry; compact: boolean }) {
  const [open, setOpen] = useState(false);
  const code = errorCodeOf(entry.responseBody);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-left hover:bg-surface-muted/60"
      >
        <span className="tabular w-[72px] shrink-0 text-xs text-fg-subtle">{formatTime(entry.startedAt)}</span>
        <HttpBadge status={entry.status} />
        <span className="font-mono text-xs font-semibold text-fg">{entry.method}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-muted">{entry.path}</span>
        {code ? (
          <Badge tone={entry.ok ? 'info' : 'danger'} mono>
            {code}
          </Badge>
        ) : null}
        {appliedFlag(entry.responseBody)}
        <span className="tabular text-xs text-fg-subtle">{formatDuration(entry.durationMs)}</span>
      </button>
      {open ? (
        <div className={`grid gap-3 border-t border-border bg-surface-muted/40 px-5 py-3 ${compact ? '' : 'md:grid-cols-2'}`}>
          <JsonBlock label="Request body" value={entry.requestBody} />
          <JsonBlock label="Response body" value={entry.responseBody} />
        </div>
      ) : null}
    </li>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const text = value === null || value === undefined ? '(empty)' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
      <pre className="max-h-72 overflow-auto rounded-md border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed text-fg">{text}</pre>
    </div>
  );
}

function errorCodeOf(body: unknown): string | null {
  if (body && typeof body === 'object' && 'error' in body) {
    const v = (body as { error: unknown }).error;
    return typeof v === 'string' ? v : null;
  }
  return null;
}

function appliedFlag(body: unknown) {
  if (body && typeof body === 'object' && 'applied' in body) {
    const applied = (body as { applied: unknown }).applied;
    if (applied === true) return <Badge tone="success">applied</Badge>;
    if (applied === false) return <Badge tone="info">applied=false</Badge>;
  }
  return null;
}
