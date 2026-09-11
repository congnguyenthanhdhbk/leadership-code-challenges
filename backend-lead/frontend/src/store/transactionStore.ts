import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CallbackStatus, FundingTxStatus, Money } from '@/lib/api/types';
import { persistOptions } from './persist';

// The API exposes no list endpoints for deposits, wagers or withdrawals, so this store
// is the frontend's own record of what it asked the API to do and what came back.

export interface DepositRecord {
  id: string;
  memberId: string;
  pspRef: string;
  amount: Money;
  turnoverMultiplier: number;
  status: FundingTxStatus;
  settledAmount: Money | null;
  amountMismatch: boolean;
  createdAt: string;
  updatedAt: string;
  // Every callback delivery we sent for this deposit, newest first.
  callbacks: CallbackDelivery[];
}

export interface CallbackDelivery {
  id: string;
  sentAt: string;
  requestedStatus: CallbackStatus;
  requestedAmount: Money;
  httpStatus: number | null;
  // From the 200 body: true when this delivery moved the deposit, false on an
  // idempotent retry. null when the API rejected the delivery.
  applied: boolean | null;
  errorCode: string | null;
}

export interface WagerRecord {
  id: string;
  memberId: string;
  walletId: string;
  amount: Money;
  balanceAfter: Money;
  turnoverAccruedAfter: Money;
  createdAt: string;
}

export interface WithdrawalRecord {
  id: string;
  memberId: string;
  amount: Money;
  status: 'Pending';
  balanceAfter: Money;
  createdAt: string;
}

interface TransactionState {
  deposits: DepositRecord[];
  wagers: WagerRecord[];
  withdrawals: WithdrawalRecord[];

  addDeposit: (deposit: DepositRecord) => void;
  updateDeposit: (id: string, patch: Partial<Omit<DepositRecord, 'id' | 'callbacks'>>) => void;
  addCallbackDelivery: (pspRef: string, delivery: CallbackDelivery) => void;
  addWager: (wager: WagerRecord) => void;
  addWithdrawal: (withdrawal: WithdrawalRecord) => void;
  removeForMember: (memberId: string) => void;
  reset: () => void;
}

const initial = { deposits: [] as DepositRecord[], wagers: [] as WagerRecord[], withdrawals: [] as WithdrawalRecord[] };

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set) => ({
      ...initial,

      addDeposit: (deposit) => set((s) => ({ deposits: [deposit, ...s.deposits] })),

      updateDeposit: (id, patch) =>
        set((s) => ({
          deposits: s.deposits.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d)),
        })),

      addCallbackDelivery: (pspRef, delivery) =>
        set((s) => ({
          deposits: s.deposits.map((d) => (d.pspRef === pspRef ? { ...d, callbacks: [delivery, ...d.callbacks] } : d)),
        })),

      addWager: (wager) => set((s) => ({ wagers: [wager, ...s.wagers] })),

      addWithdrawal: (withdrawal) => set((s) => ({ withdrawals: [withdrawal, ...s.withdrawals] })),

      removeForMember: (memberId) =>
        set((s) => ({
          deposits: s.deposits.filter((d) => d.memberId !== memberId),
          wagers: s.wagers.filter((w) => w.memberId !== memberId),
          withdrawals: s.withdrawals.filter((w) => w.memberId !== memberId),
        })),

      reset: () => set({ ...initial }),
    }),
    persistOptions<TransactionState>('transactions', (s) => ({
      deposits: s.deposits,
      wagers: s.wagers,
      withdrawals: s.withdrawals,
    })),
  ),
);

export const selectDepositsFor = (memberId: string | null) => (s: TransactionState) =>
  memberId ? s.deposits.filter((d) => d.memberId === memberId) : [];

export const selectWagersFor = (memberId: string | null) => (s: TransactionState) =>
  memberId ? s.wagers.filter((w) => w.memberId === memberId) : [];

export const selectWithdrawalsFor = (memberId: string | null) => (s: TransactionState) =>
  memberId ? s.withdrawals.filter((w) => w.memberId === memberId) : [];

export const selectDepositByPspRef = (pspRef: string) => (s: TransactionState) =>
  s.deposits.find((d) => d.pspRef === pspRef) ?? null;
