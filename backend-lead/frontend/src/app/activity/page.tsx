'use client';

import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { PageHeader } from '@/components/layout/PageHeader';
import { HydrationGate } from '@/components/providers/HydrationGate';

export default function ActivityPage() {
  return (
    <HydrationGate>
      <PageHeader
        title="Activity"
        description="The raw conversation with the API. Useful for checking the exact 200 applied=false on a duplicate callback, or the outstanding figure in a 422."
      />
      <ActivityFeed />
    </HydrationGate>
  );
}
