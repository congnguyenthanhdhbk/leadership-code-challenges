import type { Transaction } from 'sequelize';
import { WalletTx, WalletTxKind } from '../db/models';

export interface LedgerEntry {
  walletId: string;
  fundingTxId: string | null;
  kind: WalletTxKind;
  // Signed, canonical 18-decimal string. Credits positive, debits negative.
  amount: string;
  balanceAfter: string;
}

// Append-only by construction: this repository exposes one write method and it inserts.
// The database trigger on wallet_txs rejects UPDATE and DELETE as the second line.
export class LedgerRepository {
  append(entry: LedgerEntry, tx: Transaction): Promise<WalletTx> {
    return WalletTx.create({ ...entry }, { transaction: tx });
  }
}
