import { create } from 'zustand';
import { api } from '@/lib/api/endpoints';

export type HealthStatus = 'unknown' | 'checking' | 'ok' | 'down';

interface HealthState {
  status: HealthStatus;
  lastCheckedAt: string | null;
  lastError: string | null;
  check: () => Promise<void>;
}

export const useHealthStore = create<HealthState>()((set, get) => ({
  status: 'unknown',
  lastCheckedAt: null,
  lastError: null,

  check: async () => {
    if (get().status === 'checking') return;
    set((s) => ({ status: s.status === 'unknown' ? 'checking' : s.status }));
    try {
      await api.health();
      set({ status: 'ok', lastCheckedAt: new Date().toISOString(), lastError: null });
    } catch (err) {
      set({
        status: 'down',
        lastCheckedAt: new Date().toISOString(),
        lastError: err instanceof Error ? err.message : 'health check failed',
      });
    }
  },
}));
