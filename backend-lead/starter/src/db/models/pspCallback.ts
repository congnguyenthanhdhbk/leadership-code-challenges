import { DataTypes, Model, Sequelize } from 'sequelize';

export type PspCallbackOutcome = 'received' | 'applied' | 'duplicate' | 'orphan' | 'rejected';

// Raw inbox of every callback delivery. Written before the money transaction opens, so a
// crash mid-processing leaves a `received` row behind as evidence.
export class PspCallback extends Model {
  declare id: string;
  declare pspRef: string;
  declare payload: Record<string, unknown>;
  declare outcome: PspCallbackOutcome;
  declare receivedAt: Date;
  declare processedAt: Date | null;
}

export function initPspCallback(sequelize: Sequelize): void {
  PspCallback.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      pspRef: { type: DataTypes.STRING(128), allowNull: false },
      payload: { type: DataTypes.JSONB, allowNull: false },
      outcome: {
        type: DataTypes.ENUM('received', 'applied', 'duplicate', 'orphan', 'rejected'),
        allowNull: false,
        defaultValue: 'received',
      },
      receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      processedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: 'psp_callbacks', underscored: true, timestamps: false },
  );
}
