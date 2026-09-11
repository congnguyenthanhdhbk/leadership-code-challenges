import type { Transaction } from 'sequelize';
import { sequelize } from './sequelize';

// Unit of Work boundary. Every money movement in this codebase runs inside exactly one
// of these: lock, check, write, commit. Services depend on the interface so a test can
// substitute a runner without touching Sequelize.
export interface TransactionRunner {
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
}

export class SequelizeTransactionRunner implements TransactionRunner {
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return sequelize.transaction(work);
  }
}
