import { create } from 'zustand';
import { newId } from '@/lib/format';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const MAX_VISIBLE = 5;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (toast) => {
    const id = newId();
    set((s) => ({ toasts: [...s.toasts, { id, createdAt: Date.now(), ...toast }].slice(-MAX_VISIBLE) }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

export const toast = {
  success: (title: string, detail?: string) => useToastStore.getState().push({ tone: 'success', title, detail }),
  error: (title: string, detail?: string) => useToastStore.getState().push({ tone: 'error', title, detail }),
  info: (title: string, detail?: string) => useToastStore.getState().push({ tone: 'info', title, detail }),
  warning: (title: string, detail?: string) => useToastStore.getState().push({ tone: 'warning', title, detail }),
};
