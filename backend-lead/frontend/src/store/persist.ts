'use client';

import { useEffect, useState } from 'react';
import { createJSONStorage, type PersistOptions, type PersistStorage } from 'zustand/middleware';

// Shared persist options. Stores skip hydration on creation so the server render and
// the first client render agree; StoreHydrator triggers rehydrate() once mounted and
// components gate on useHydrated() before reading persisted state.
export function persistOptions<T>(name: string, partialize?: (state: T) => Partial<T>): PersistOptions<T, Partial<T>> {
  return {
    name: `mini-wallet:${name}`,
    version: 1,
    storage: safeStorage<Partial<T>>(),
    skipHydration: true,
    partialize: partialize ?? ((state) => state),
  };
}

function safeStorage<S>(): PersistStorage<S> | undefined {
  return createJSONStorage<S>(() => {
    if (typeof window === 'undefined') return noopStorage;
    try {
      // Accessing localStorage can throw in private windows or with blocked site data.
      window.localStorage.getItem('__probe__');
      return window.localStorage;
    } catch {
      return noopStorage;
    }
  });
}

const noopStorage: Storage = {
  length: 0,
  clear: () => undefined,
  getItem: () => null,
  key: () => null,
  removeItem: () => undefined,
  setItem: () => undefined,
};

interface PersistApiLike {
  persist: {
    rehydrate: () => Promise<void> | void;
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
}

// True once every given store has finished rehydrating from localStorage.
export function useHydrated(...stores: PersistApiLike[]): boolean {
  const [hydrated, setHydrated] = useState(() => stores.every((s) => s.persist.hasHydrated()));

  useEffect(() => {
    const check = () => setHydrated(stores.every((s) => s.persist.hasHydrated()));
    const unsubs = stores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return hydrated;
}

export function rehydrateAll(...stores: PersistApiLike[]): void {
  for (const s of stores) {
    if (!s.persist.hasHydrated()) void s.persist.rehydrate();
  }
}
