import type { ReactNode } from 'react';
import type { FundingTxStatus } from '@/lib/api/types';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-fg-muted border-border',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
  info: 'bg-info-soft text-info border-info/20',
  accent: 'bg-accent-soft text-accent border-accent/20',
};

export function Badge({ tone = 'neutral', children, className = '', mono = false }: { tone?: BadgeTone; children: ReactNode; className?: string; mono?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${mono ? 'font-mono' : ''} ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: FundingTxStatus }) {
  const tone: BadgeTone = status === 'Completed' ? 'success' : status === 'Failed' ? 'danger' : 'warning';
  return <Badge tone={tone}>{status}</Badge>;
}

export function HttpBadge({ status }: { status: number | null }) {
  if (status === null) return <Badge tone="danger" mono>ERR</Badge>;
  const tone: BadgeTone = status < 300 ? 'success' : status < 500 ? 'warning' : 'danger';
  return (
    <Badge tone={tone} mono>
      {status}
    </Badge>
  );
}
