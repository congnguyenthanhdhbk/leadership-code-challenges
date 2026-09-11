import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RequestRecord } from '@/lib/api/client';
import { newId } from '@/lib/format';
import { persistOptions } from './persist';

export interface ActivityEntry extends RequestRecord {
  id: string;
}

const MAX_ENTRIES = 300;

interface ActivityState {
  entries: ActivityEntry[];
  log: (record: RequestRecord) => void;
  clear: () => void;
}

// Every HTTP round trip the API client makes, newest first. Wired to the client in
// StoreHydrator via observeRequests, so no other code has to remember to log.
export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({
      entries: [],
      log: (record) => set((s) => ({ entries: [{ id: newId(), ...record }, ...s.entries].slice(0, MAX_ENTRIES) })),
      clear: () => set({ entries: [] }),
    }),
    persistOptions<ActivityState>('activity', (s) => ({ entries: s.entries })),
  ),
);
