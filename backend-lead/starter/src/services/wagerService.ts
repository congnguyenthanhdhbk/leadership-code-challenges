import type BigNumber from 'bignumber.js';
import type { Transaction } from 'sequelize';
import type { Wallet } from '../db/models';
import { NotFoundError } from '../lib/errors';
import type { WalletMovement } from '../domain/walletMovement';
import { SufficientBalancePolicy, WalletPolicy } from '../domain/walletPolicies';
import { WalletDebitOperation } from './walletDebitOperation';

export interface WagerRequest {
  walletId: string;
  amount: string;
}

export interface WagerResult {
  walletId: string;
  balance: string;
  turnoverAccrued: string;
}

// A3. Debit under the wallet lock and accrue turnover equal to the stake.
export class WagerService extends WalletDebitOperation<WagerRequest, WagerResult> {
  protected readonly policies: readonly WalletPolicy[] = [new SufficientBalancePolicy()];

  protected lockWallet(request: WagerRequest, tx: Transaction): Promise<Wallet | null> {
    return this.deps.wallets.lockById(request.walletId, tx);
  }

  protected notFound(request: WagerRequest): NotFoundError {
    return new NotFoundError('wallet', request.walletId);
  }

  protected async buildMovement(_request: WagerRequest, _wallet: Wallet, amount: BigNumber): Promise<WalletMovement> {
    return { kind: 'wager_debit', amount, turnoverAccruedDelta: amount };
  }

  protected toResult(_request: WagerRequest, wallet: Wallet): WagerResult {
    return { walletId: wallet.id, balance: wallet.balance, turnoverAccrued: wallet.turnoverAccrued };
  }
}
