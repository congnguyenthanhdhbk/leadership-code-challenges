'use client';

import { useEffect } from 'react';
import { useToastStore, type Toast, type ToastTone } from '@/store/toastStore';

const toneClass: Record<ToastTone, string> = {
  success: 'border-success/30 bg-success-soft text-success',
  error: 'border-danger/30 bg-danger-soft text-danger',
  warning: 'border-warning/30 bg-warning-soft text-warning',
  info: 'border-info/30 bg-info-soft text-info',
};

const AUTO_DISMISS_MS: Record<ToastTone, number> = {
  success: 5000,
  info: 6000,
  warning: 7000,
  error: 9000,
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-4 sm:items-end sm:px-6" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS[toast.tone]);
    return () => clearTimeout(timer);
  }, [toast.id, toast.tone, dismiss]);

  return (
    <div className={`toast-enter pointer-events-auto w-full max-w-sm rounded-lg border bg-surface p-3 shadow-card ${toneClass[toast.tone]}`} role="status">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.detail ? <p className="mt-0.5 text-xs text-fg-muted">{toast.detail}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => dismiss(toast.id)}
          className="rounded p-1 text-fg-subtle hover:bg-surface-muted hover:text-fg"
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
