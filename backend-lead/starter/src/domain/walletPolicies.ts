import type BigNumber from 'bignumber.js';
import { InsufficientBalanceError, TurnoverNotMetError } from '../lib/errors';
import { dec, toMoney } from '../lib/money';

// The three figures a policy may look at. Structural, so a Wallet model instance
// satisfies it and so do plain objects in unit tests.
export interface WalletSnapshot {
  balance: string;
  turnoverRequired: string;
  turnoverAccrued: string;
}

// Policy: one business rule that can veto a debit. Policies are pure, ordered by the
// caller, and throw a DomainError with the body the client needs. They run under the
// wallet row lock, so the figures they read are the figures the debit will apply to.
export interface WalletPolicy {
  check(wallet: WalletSnapshot, amount: BigNumber): void;
}

// A4 anti-abuse control. Lifetime counters; outstanding is max(required - accrued, 0).
export class TurnoverMetPolicy implements WalletPolicy {
  // The requested amount is irrelevant here: the gate is about turnover, not size.
  check(wallet: WalletSnapshot, _amount: BigNumber): void {
    const required = dec(wallet.turnoverRequired);
    const accrued = dec(wallet.turnoverAccrued);
    if (accrued.isLessThan(required)) {
      throw new TurnoverNotMetError(toMoney(required), toMoney(accrued), toMoney(required.minus(accrued)));
    }
  }
}

// A wallet never goes negative. The CHECK constraint on wallets.balance is the last line
// behind this one.
export class SufficientBalancePolicy implements WalletPolicy {
  check(wallet: WalletSnapshot, amount: BigNumber): void {
    const balance = dec(wallet.balance);
    if (balance.isLessThan(amount)) {
      throw new InsufficientBalanceError(toMoney(balance), toMoney(amount));
    }
  }
}
