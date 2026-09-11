import { randomUUID } from 'crypto';
import type BigNumber from 'bignumber.js';
import type { Transaction } from 'sequelize';
import type { Wallet, WalletTx } from '../db/models';
import { NotFoundError } from '../lib/errors';
import { toMoney } from '../lib/money';
import type { WalletMovement } from '../domain/walletMovement';
import { SufficientBalancePolicy, TurnoverMetPolicy, WalletPolicy } from '../domain/walletPolicies';
import type { FundingTxRepository } from '../repositories/fundingTxRepository';
import { WalletDebitOperation, WalletOperationDeps } from './walletDebitOperation';

export interface WithdrawalRequest {
  memberId: string;
  amount: string;
}

export interface WithdrawalResult {
  id: string;
  status: 'Pending';
  amount: string;
  balance: string;
}

// A4. Turnover gate first (the anti-abuse control, with the outstanding figure in the 422
// body), then the balance gate, then debit + ledger row + Pending withdrawal row, all in
// one transaction. Approval of the payout is out of scope.
export class WithdrawalService extends WalletDebitOperation<WithdrawalRequest, WithdrawalResult> {
  // Order matters and is deliberate: turnover is checked before balance.
  protected readonly policies: readonly WalletPolicy[] = [new TurnoverMetPolicy(), new SufficientBalancePolicy()];

  constructor(
    deps: WalletOperationDeps,
    private readonly fundingTxs: FundingTxRepository,
  ) {
    super(deps);
  }

  protected lockWallet(request: WithdrawalRequest, tx: Transaction): Promise<Wallet | null> {
    return this.deps.wallets.lockByMemberId(request.memberId, tx);
  }

  protected notFound(request: WithdrawalRequest): NotFoundError {
    return new NotFoundError('member', request.memberId);
  }

  protected async buildMovement(
    _request: WithdrawalRequest,
    wallet: Wallet,
    amount: BigNumber,
    tx: Transaction,
  ): Promise<WalletMovement> {
    const payout = await this.fundingTxs.create(
      {
        walletId: wallet.id,
        kind: 'withdrawal',
        amount: toMoney(amount),
        pspRef: randomUUID(),
        turnoverMultiplier: 0,
      },
      tx,
    );
    return { kind: 'withdrawal_debit', amount, fundingTxId: payout.id };
  }

  protected toResult(request: WithdrawalRequest, wallet: Wallet, posted: WalletTx): WithdrawalResult {
    return {
      // The ledger row is linked to the payout it funds; buildMovement set it.
      id: posted.fundingTxId as string,
      status: 'Pending',
      amount: toMoney(request.amount),
      balance: wallet.balance,
    };
  }
}
