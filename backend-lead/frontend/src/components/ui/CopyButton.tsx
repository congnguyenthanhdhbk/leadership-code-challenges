'use client';

import { useState } from 'react';

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable; nothing to do */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded px-1.5 py-0.5 text-[11px] font-medium text-fg-subtle hover:bg-surface-muted hover:text-fg"
      aria-label={`${label} ${value}`}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

export function Id({ value, keep = 8 }: { value: string; keep?: number }) {
  const short = value.length > keep + 1 ? `${value.slice(0, keep)}…` : value;
  return (
    <span className="inline-flex items-center gap-1">
      <code className="font-mono text-xs text-fg-muted" title={value}>
        {short}
      </code>
      <CopyButton value={value} />
    </span>
  );
}
