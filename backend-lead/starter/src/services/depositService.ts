import { randomUUID } from 'crypto';
import type { FundingTx } from '../db/models';
import { NotFoundError } from '../lib/errors';
import { toMoney } from '../lib/money';
import type { WalletRepository } from '../repositories/walletRepository';
import type { FundingTxRepository } from '../repositories/fundingTxRepository';

export interface CreateDepositInput {
  memberId: string;
  amount: string;
  turnoverMultiplier: number;
}

// A1. Creates a Pending deposit. No money moves, so this is a single-row insert and needs
// neither a lock nor a transaction. The pspRef is opaque to us; the PSP echoes it back in
// the callback and UNIQUE (psp_ref) guarantees there is exactly one row for it to match.
export class DepositService {
  constructor(
    private readonly wallets: WalletRepository,
    private readonly fundingTxs: FundingTxRepository,
  ) {}

  async create(input: CreateDepositInput): Promise<FundingTx> {
    const wallet = await this.wallets.findByMemberId(input.memberId);
    if (!wallet) {
      throw new NotFoundError('member', input.memberId);
    }

    return this.fundingTxs.create({
      walletId: wallet.id,
      kind: 'deposit',
      amount: toMoney(input.amount),
      pspRef: randomUUID(),
      turnoverMultiplier: input.turnoverMultiplier,
    });
  }
}
