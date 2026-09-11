import type { FundingTxStatus } from '../db/models';
import { InvalidTransitionError } from '../lib/errors';

// The only place that knows which funding transaction transitions are legal.
//
//   Pending ──▶ Completed
//   Pending ──▶ Failed
//
// Terminal states have no outgoing edges. Asking for the state a row is already in is a
// no-op (a PSP retry of an already-applied outcome); asking for a different terminal
// state is a conflict and is rejected loudly rather than silently applied.
const EDGES: Readonly<Record<FundingTxStatus, readonly FundingTxStatus[]>> = {
  Pending: ['Completed', 'Failed'],
  Completed: [],
  Failed: [],
};

export type TransitionDecision = 'apply' | 'noop';

export function transition(from: FundingTxStatus, to: FundingTxStatus): TransitionDecision {
  if (from === to) {
    return 'noop';
  }
  if (EDGES[from].includes(to)) {
    return 'apply';
  }
  throw new InvalidTransitionError(from, to);
}

export function isTerminal(status: FundingTxStatus): boolean {
  return EDGES[status].length === 0;
}
