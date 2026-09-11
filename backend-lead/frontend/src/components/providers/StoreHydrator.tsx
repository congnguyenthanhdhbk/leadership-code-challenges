'use client';

import { useEffect } from 'react';
import { observeRequests } from '@/lib/api/client';
import { useActivityStore } from '@/store/activityStore';
import { useHealthStore } from '@/store/healthStore';
import { rehydrateAll } from '@/store/persist';
import { useSessionStore } from '@/store/sessionStore';
import { useTransactionStore } from '@/store/transactionStore';

const HEALTH_INTERVAL_MS = 15_000;

// Mounted once in the root layout. Rehydrates the persisted stores after the first
// client render, pipes every API round trip into the activity feed, and polls health.
export function StoreHydrator() {
  useEffect(() => {
    rehydrateAll(useSessionStore, useTransactionStore, useActivityStore);
  }, []);

  useEffect(() => {
    return observeRequests((record) => {
      // Health polls would drown the feed.
      if (record.path === '/health') return;
      useActivityStore.getState().log(record);
    });
  }, []);

  useEffect(() => {
    const check = () => void useHealthStore.getState().check();
    check();
    const timer = setInterval(check, HEALTH_INTERVAL_MS);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return null;
}
