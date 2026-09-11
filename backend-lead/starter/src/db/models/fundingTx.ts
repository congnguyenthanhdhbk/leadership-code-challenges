import { DataTypes, Model, Sequelize } from 'sequelize';

export type FundingTxKind = 'deposit' | 'withdrawal';
export type FundingTxStatus = 'Pending' | 'Completed' | 'Failed';

export const FUNDING_TX_STATUSES: readonly FundingTxStatus[] = ['Pending', 'Completed', 'Failed'];

export class FundingTx extends Model {
  declare id: string;
  declare walletId: string;
  declare kind: FundingTxKind;
  declare status: FundingTxStatus;
  // DECIMAL columns come back from pg as strings. Keep them that way; see src/lib/money.ts.
  declare amount: string;
  declare settledAmount: string | null;
  declare amountMismatch: boolean;
  declare pspRef: string;
  // A count, not money: plain integer is correct here.
  declare turnoverMultiplier: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initFundingTx(sequelize: Sequelize): void {
  FundingTx.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      walletId: { type: DataTypes.UUID, allowNull: false },
      kind: { type: DataTypes.ENUM('deposit', 'withdrawal'), allowNull: false },
      status: {
        type: DataTypes.ENUM(...FUNDING_TX_STATUSES),
        allowNull: false,
        defaultValue: 'Pending',
      },
      amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      settledAmount: { type: DataTypes.DECIMAL(36, 18), allowNull: true },
      amountMismatch: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      pspRef: { type: DataTypes.STRING(128), allowNull: false, unique: true },
      turnoverMultiplier: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    },
    { sequelize, tableName: 'funding_txs', underscored: true },
  );
}
