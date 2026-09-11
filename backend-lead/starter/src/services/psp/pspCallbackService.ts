import type { FundingTx, PspCallbackOutcome } from '../../db/models';
import { transition } from '../../domain/fundingStateMachine';
import { NotFoundError, UnsupportedCallbackError } from '../../lib/errors';
import type { TransactionRunner } from '../../db/transactionRunner';
import type { FundingTxRepository } from '../../repositories/fundingTxRepository';
import type { CallbackInboxRepository } from '../../repositories/callbackInboxRepository';
import type { CallbackOutcomeHandler, CallbackStatus, PspCallbackInput } from './callbackOutcomeHandlers';

export type { CallbackStatus, PspCallbackInput } from './callbackOutcomeHandlers';

export interface PspCallbackResult {
  // true when this delivery moved the funding tx to its terminal state;
  // false when the same outcome had already been applied (idempotent retry).
  applied: boolean;
  fundingTx: FundingTx;
}

export interface PspCallbackDeps {
  transactions: TransactionRunner;
  fundingTxs: FundingTxRepository;
  inbox: CallbackInboxRepository;
  handlers: Record<CallbackStatus, CallbackOutcomeHandler>;
}

// A2. Exactly-once credit rests on three independent guards:
//   1. FOR UPDATE on the funding row makes concurrent deliveries take turns.
//   2. The state machine makes every turn after the first a read-only no-op (or a 409).
//   3. UNIQUE (psp_ref) means there is never a second funding row to race between.
// This service owns the guards. What a terminal outcome *does* is delegated to the
// handler strategy for that outcome.
export class PspCallbackService {
  constructor(private readonly deps: PspCallbackDeps) {}

  async handle(input: PspCallbackInput, rawPayload: unknown): Promise<PspCallbackResult> {
    // Persist the raw delivery before any money moves: evidence if processing crashes,
    // and replay material for adapter fixtures.
    const inboxRow = await this.deps.inbox.record(input.pspRef, rawPayload);

    // Set by the branches that throw a domain error, so the inbox can record why.
    let failureOutcome: PspCallbackOutcome | null = null;

    try {
      const { outcome, result } = await this.deps.transactions.run(async (tx) => {
        const fundingTx = await this.deps.fundingTxs.lockByPspRef(input.pspRef, tx);

        if (!fundingTx) {
          failureOutcome = 'orphan';
          throw new NotFoundError('pspRef', input.pspRef);
        }
        if (fundingTx.kind !== 'deposit') {
          // Payout callbacks are out of scope; never let one credit a wallet.
          failureOutcome = 'rejected';
          throw new UnsupportedCallbackError(input.pspRef, fundingTx.kind);
        }

        const handler = this.deps.handlers[input.status];
        let decision: ReturnType<typeof transition>;
        try {
          decision = transition(fundingTx.status, handler.target);
        } catch (err) {
          failureOutcome = 'rejected';
          throw err;
        }

        if (decision === 'noop') {
          return { outcome: 'duplicate' as const, result: { applied: false, fundingTx } };
        }

        await handler.apply(tx, fundingTx, input);
        return { outcome: 'applied' as const, result: { applied: true, fundingTx } };
      });

      await this.deps.inbox.markOutcome(inboxRow, outcome);
      return result;
    } catch (err) {
      if (failureOutcome) {
        await this.deps.inbox.markOutcome(inboxRow, failureOutcome);
      }
      throw err;
    }
  }
}
