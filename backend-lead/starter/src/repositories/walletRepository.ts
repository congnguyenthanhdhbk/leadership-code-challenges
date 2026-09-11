import type { Transaction } from 'sequelize';
import { Wallet } from '../db/models';

export type WalletChanges = Partial<Pick<Wallet, 'balance' | 'turnoverRequired' | 'turnoverAccrued'>>;

// Repository: the only place that knows how wallets are queried and locked. The two
// lock* methods are the FOR UPDATE reads every money movement starts with.
export class WalletRepository {
  findByMemberId(memberId: string): Promise<Wallet | null> {
    return Wallet.findOne({ where: { memberId } });
  }

  lockById(id: string, tx: Transaction): Promise<Wallet | null> {
    return Wallet.findByPk(id, { lock: tx.LOCK.UPDATE, transaction: tx });
  }

  lockByMemberId(memberId: string, tx: Transaction): Promise<Wallet | null> {
    return Wallet.findOne({ where: { memberId }, lock: tx.LOCK.UPDATE, transaction: tx });
  }

  update(wallet: Wallet, changes: WalletChanges, tx: Transaction): Promise<Wallet> {
    return wallet.update(changes, { transaction: tx });
  }
}
