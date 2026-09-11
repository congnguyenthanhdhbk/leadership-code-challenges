import type { ReactNode } from 'react';

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border px-4 py-8 text-center">
      <p className="text-sm font-medium text-fg-muted">{title}</p>
      {children ? <p className="max-w-sm text-xs text-fg-subtle">{children}</p> : null}
    </div>
  );
}
