import type { Transaction } from 'sequelize';
import type { Wallet, WalletTx } from '../db/models';
import { InsufficientBalanceError } from '../lib/errors';
import { dec, toMoney, ZERO } from '../lib/money';
import { WalletMovement, signedAmount } from '../domain/walletMovement';
import type { WalletRepository } from '../repositories/walletRepository';
import type { LedgerRepository } from '../repositories/ledgerRepository';

// The one code path that changes wallets.balance. It requires a wallet the caller has
// already locked FOR UPDATE inside `tx`, and writes the new balance and the ledger row in
// that same transaction. Nothing else in src/ assigns balance.
export class LedgerService {
  constructor(
    private readonly wallets: WalletRepository,
    private readonly ledger: LedgerRepository,
  ) {}

  async post(tx: Transaction, wallet: Wallet, movement: WalletMovement): Promise<WalletTx> {
    if (movement.amount.isLessThanOrEqualTo(0)) {
      throw new Error(`Wallet movement amount must be positive, got ${movement.amount.toFixed()}`);
    }

    const signed = signedAmount(movement);
    const balanceBefore = dec(wallet.balance);
    const balanceAfter = balanceBefore.plus(signed);

    if (balanceAfter.isLessThan(0)) {
      // Policies should have caught this. Kept as the service-layer backstop so the
      // caller gets a domain error rather than a CHECK constraint violation.
      throw new InsufficientBalanceError(toMoney(balanceBefore), toMoney(movement.amount));
    }

    await this.wallets.update(
      wallet,
      {
        balance: toMoney(balanceAfter),
        turnoverRequired: toMoney(dec(wallet.turnoverRequired).plus(movement.turnoverRequiredDelta ?? ZERO)),
        turnoverAccrued: toMoney(dec(wallet.turnoverAccrued).plus(movement.turnoverAccruedDelta ?? ZERO)),
      },
      tx,
    );

    return this.ledger.append(
      {
        walletId: wallet.id,
        fundingTxId: movement.fundingTxId ?? null,
        kind: movement.kind,
        amount: toMoney(signed),
        balanceAfter: toMoney(balanceAfter),
      },
      tx,
    );
  }
}
