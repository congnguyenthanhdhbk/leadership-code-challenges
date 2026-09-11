import type BigNumber from 'bignumber.js';
import type { Transaction } from 'sequelize';
import type { Wallet, WalletTx } from '../db/models';
import type { DomainError } from '../lib/errors';
import { dec } from '../lib/money';
import type { WalletMovement } from '../domain/walletMovement';
import type { WalletPolicy } from '../domain/walletPolicies';
import type { TransactionRunner } from '../db/transactionRunner';
import type { WalletRepository } from '../repositories/walletRepository';
import type { LedgerService } from './ledgerService';

export interface WalletOperationDeps {
  transactions: TransactionRunner;
  wallets: WalletRepository;
  ledger: LedgerService;
}

// Template Method. Every debit from a wallet follows the same skeleton, and the skeleton
// is where the concurrency guarantees live:
//
//   1. open one transaction                (Unit of Work)
//   2. lock the wallet row FOR UPDATE      (serialises concurrent callers)
//   3. run the policies in order           (turnover, balance, ...)
//   4. build the movement                  (may insert a funding row)
//   5. post it through the ledger service  (balance + ledger row, same transaction)
//
// Subclasses fill in how the wallet is found, which policies apply, what the movement is
// and what to return. They cannot reorder or skip a step.
export abstract class WalletDebitOperation<TRequest extends { amount: string }, TResult> {
  constructor(protected readonly deps: WalletOperationDeps) {}

  async execute(request: TRequest): Promise<TResult> {
    return this.deps.transactions.run(async (tx) => {
      const wallet = await this.lockWallet(request, tx);
      if (!wallet) {
        throw this.notFound(request);
      }

      const amount = dec(request.amount);
      for (const policy of this.policies) {
        policy.check(wallet, amount);
      }

      const movement = await this.buildMovement(request, wallet, amount, tx);
      const posted = await this.deps.ledger.post(tx, wallet, movement);
      return this.toResult(request, wallet, posted);
    });
  }

  protected abstract readonly policies: readonly WalletPolicy[];
  protected abstract lockWallet(request: TRequest, tx: Transaction): Promise<Wallet | null>;
  protected abstract notFound(request: TRequest): DomainError;
  protected abstract buildMovement(
    request: TRequest,
    wallet: Wallet,
    amount: BigNumber,
    tx: Transaction,
  ): Promise<WalletMovement>;
  protected abstract toResult(request: TRequest, wallet: Wallet, posted: WalletTx): TResult;
}
