import type { ReactNode } from 'react';

export function ErrorNote({ title, children, tone = 'danger' }: { title: string; children?: ReactNode; tone?: 'danger' | 'warning' }) {
  const cls = tone === 'danger' ? 'border-danger/30 bg-danger-soft text-danger' : 'border-warning/30 bg-warning-soft text-warning';
  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${cls}`} role="alert">
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-0.5 text-fg-muted">{children}</div> : null}
    </div>
  );
}
