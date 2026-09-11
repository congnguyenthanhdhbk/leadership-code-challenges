import type { Transaction } from 'sequelize';
import { FundingTx, FundingTxKind, FundingTxStatus } from '../db/models';

export interface NewFundingTx {
  walletId: string;
  kind: FundingTxKind;
  amount: string;
  pspRef: string;
  turnoverMultiplier: number;
}

export interface FundingTxChanges {
  status?: FundingTxStatus;
  settledAmount?: string | null;
  amountMismatch?: boolean;
}

export class FundingTxRepository {
  // Every funding transaction starts Pending. Callers cannot create one in a terminal state.
  create(attrs: NewFundingTx, tx?: Transaction): Promise<FundingTx> {
    return FundingTx.create({ ...attrs, status: 'Pending' }, { transaction: tx });
  }

  // FOR UPDATE on the funding row. Lock order everywhere in src/ is funding row, then wallet.
  lockByPspRef(pspRef: string, tx: Transaction): Promise<FundingTx | null> {
    return FundingTx.findOne({ where: { pspRef }, lock: tx.LOCK.UPDATE, transaction: tx });
  }

  update(row: FundingTx, changes: FundingTxChanges, tx: Transaction): Promise<FundingTx> {
    return row.update(changes, { transaction: tx });
  }
}
