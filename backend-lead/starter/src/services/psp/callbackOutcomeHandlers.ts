import type { Transaction } from 'sequelize';
import type { FundingTx, FundingTxStatus } from '../../db/models';
import { dec, toMoney } from '../../lib/money';
import type { WalletRepository } from '../../repositories/walletRepository';
import type { FundingTxRepository } from '../../repositories/fundingTxRepository';
import type { LedgerService } from '../ledgerService';

export type CallbackStatus = 'completed' | 'failed';

export interface PspCallbackInput {
  pspRef: string;
  status: CallbackStatus;
  amount: string;
}

// Strategy. One handler per terminal outcome a PSP can report. The callback service
// decides *whether* the transition applies (lock + state machine); the handler decides
// *what applying it means*. Adding an outcome means adding a handler, not editing the
// service.
export interface CallbackOutcomeHandler {
  readonly target: FundingTxStatus;
  apply(tx: Transaction, fundingTx: FundingTx, input: PspCallbackInput): Promise<void>;
}

// completed: credit the wallet once, add the turnover requirement, write the ledger row.
export class CompletedDepositHandler implements CallbackOutcomeHandler {
  readonly target = 'Completed' as const;

  constructor(
    private readonly wallets: WalletRepository,
    private readonly fundingTxs: FundingTxRepository,
    private readonly ledger: LedgerService,
  ) {}

  async apply(tx: Transaction, fundingTx: FundingTx, input: PspCallbackInput): Promise<void> {
    // Lock order: funding row (already held by the caller), then wallet.
    const wallet = await this.wallets.lockById(fundingTx.walletId, tx);
    if (!wallet) {
      // Unreachable: funding_txs.wallet_id is a foreign key.
      throw new Error(`wallet ${fundingTx.walletId} missing for funding tx ${fundingTx.id}`);
    }

    // Ruling: credit what the PSP says actually moved. Persist both figures and flag the
    // difference for reconciliation rather than inventing money or hiding a shortfall.
    const settled = dec(input.amount);
    const amountMismatch = !settled.isEqualTo(fundingTx.amount);
    if (amountMismatch) {
      // eslint-disable-next-line no-console
      console.warn(
        `psp callback amount mismatch pspRef=${fundingTx.pspRef} requested=${fundingTx.amount} settled=${toMoney(settled)}`,
      );
    }

    await this.ledger.post(tx, wallet, {
      kind: 'deposit_credit',
      amount: settled,
      fundingTxId: fundingTx.id,
      turnoverRequiredDelta: settled.times(fundingTx.turnoverMultiplier),
    });

    await this.fundingTxs.update(
      fundingTx,
      { status: 'Completed', settledAmount: toMoney(settled), amountMismatch },
      tx,
    );
  }
}

// failed: nothing arrived, so nothing to credit and no turnover requirement.
export class FailedDepositHandler implements CallbackOutcomeHandler {
  readonly target = 'Failed' as const;

  constructor(private readonly fundingTxs: FundingTxRepository) {}

  async apply(tx: Transaction, fundingTx: FundingTx): Promise<void> {
    await this.fundingTxs.update(fundingTx, { status: 'Failed' }, tx);
  }
}
