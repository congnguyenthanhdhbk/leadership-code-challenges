import { DataTypes, Model, Sequelize } from 'sequelize';

export type WalletTxKind = 'deposit_credit' | 'wager_debit' | 'withdrawal_debit';

// Append-only ledger. There is deliberately no update or destroy path for this model
// anywhere in src/. `amount` is signed: credits positive, debits negative.
export class WalletTx extends Model {
  declare id: string;
  declare walletId: string;
  declare fundingTxId: string | null;
  declare kind: WalletTxKind;
  declare amount: string;
  declare balanceAfter: string;
  declare createdAt: Date;
}

export function initWalletTx(sequelize: Sequelize): void {
  WalletTx.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      walletId: { type: DataTypes.UUID, allowNull: false },
      fundingTxId: { type: DataTypes.UUID, allowNull: true },
      kind: {
        type: DataTypes.ENUM('deposit_credit', 'wager_debit', 'withdrawal_debit'),
        allowNull: false,
      },
      amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      balanceAfter: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
    },
    { sequelize, tableName: 'wallet_txs', underscored: true, updatedAt: false },
  );
}
