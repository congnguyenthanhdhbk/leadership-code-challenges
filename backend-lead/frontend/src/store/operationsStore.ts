import { create } from 'zustand';
import { api } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/client';
import type { CallbackStatus, PspCallbackResponse } from '@/lib/api/types';
import { describeError } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import { newId } from '@/lib/format';
import { useSessionStore } from './sessionStore';
import { useTransactionStore, type CallbackDelivery } from './transactionStore';
import { toast } from './toastStore';

// The one place that sequences an API call with the state updates it implies. Components
// call these actions and render from the session and transaction stores; they never
// touch the API client directly. Each action resolves to an outcome instead of throwing
// so forms can render field-level feedback without try/catch boilerplate.

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: string; code: string | null; status: number | null };

export type OperationKey =
  | 'createMember'
  | 'refreshWallet'
  | 'createDeposit'
  | 'sendCallback'
  | 'placeWager'
  | 'createWithdrawal'
  | 'burst';

interface OperationsState {
  busy: Partial<Record<OperationKey, number>>;

  createMember: (username: string) => Promise<Outcome<{ memberId: string; walletId: string }>>;
  refreshWallet: (memberId?: string) => Promise<Outcome<void>>;
  createDeposit: (input: { amount: string; turnoverMultiplier: number }) => Promise<Outcome<{ id: string; pspRef: string }>>;
  sendCallback: (
    input: { pspRef: string; status: CallbackStatus; amount: string },
    opts?: { quiet?: boolean },
  ) => Promise<Outcome<PspCallbackResponse>>;
  // Fires the same callback N times in parallel: exercises the API's exactly-once credit.
  sendCallbackBurst: (input: { pspRef: string; status: CallbackStatus; amount: string; count: number }) => Promise<Outcome<PspCallbackResponse>[]>;
  placeWager: (amount: string) => Promise<Outcome<{ balance: string; turnoverAccrued: string }>>;
  // Fires N wagers in parallel: exercises the API's no-overdraw guarantee.
  placeWagerBurst: (amount: string, count: number) => Promise<Outcome<{ balance: string; turnoverAccrued: string }>[]>;
  createWithdrawal: (amount: string) => Promise<Outcome<{ id: string; balance: string }>>;
}

function failure<T>(err: unknown): Outcome<T> {
  const error = describeError(err);
  if (isApiError(err)) return { ok: false, error, code: err.code, status: err.status };
  return { ok: false, error, code: null, status: null };
}

function requireActive(): { memberId: string; walletId: string } | null {
  const s = useSessionStore.getState();
  const member = s.members.find((m) => m.id === s.activeMemberId);
  if (!member) {
    toast.warning('No member selected', 'Create or select a member first.');
    return null;
  }
  return { memberId: member.id, walletId: member.walletId };
}

export const useOperationsStore = create<OperationsState>()((set, get) => {
  const track = async <T>(key: OperationKey, fn: () => Promise<T>): Promise<T> => {
    set((s) => ({ busy: { ...s.busy, [key]: (s.busy[key] ?? 0) + 1 } }));
    try {
      return await fn();
    } finally {
      set((s) => ({ busy: { ...s.busy, [key]: Math.max(0, (s.busy[key] ?? 1) - 1) } }));
    }
  };

  // Best-effort resync after a money movement. Failures are already logged to the
  // activity feed by the client, so only the caller's toast matters here.
  const silentRefresh = async (memberId: string) => {
    try {
      const wallet = await api.getWallet(memberId);
      useSessionStore.getState().setWallet(wallet);
    } catch {
      /* activity feed has the record */
    }
  };

  return {
    busy: {},

    createMember: (username) =>
      track('createMember', async () => {
        try {
          const res = await api.createMember({ username });
          useSessionStore.getState().addMember(
            { id: res.member.id, username: res.member.username, walletId: res.wallet.id, createdAt: new Date().toISOString() },
            res.wallet,
          );
          toast.success(`Member ${res.member.username} created`, 'An empty wallet was opened for them.');
          return { ok: true, value: { memberId: res.member.id, walletId: res.wallet.id } };
        } catch (err) {
          const out = failure<{ memberId: string; walletId: string }>(err);
          toast.error('Could not create member', out.ok ? undefined : out.error);
          return out;
        }
      }),

    refreshWallet: (memberId) =>
      track('refreshWallet', async () => {
        const id = memberId ?? useSessionStore.getState().activeMemberId;
        if (!id) return { ok: false, error: 'No member selected.', code: null, status: null };
        try {
          const wallet = await api.getWallet(id);
          useSessionStore.getState().setWallet(wallet);
          return { ok: true, value: undefined };
        } catch (err) {
          const out = failure<void>(err);
          toast.error('Could not load wallet', out.ok ? undefined : out.error);
          return out;
        }
      }),

    createDeposit: ({ amount, turnoverMultiplier }) =>
      track('createDeposit', async () => {
        const active = requireActive();
        if (!active) return { ok: false, error: 'No member selected.', code: null, status: null };
        try {
          const res = await api.createDeposit({ memberId: active.memberId, amount, turnoverMultiplier });
          const now = new Date().toISOString();
          useTransactionStore.getState().addDeposit({
            id: res.id,
            memberId: active.memberId,
            pspRef: res.pspRef,
            amount: res.amount,
            turnoverMultiplier: res.turnoverMultiplier,
            status: res.status,
            settledAmount: null,
            amountMismatch: false,
            createdAt: now,
            updatedAt: now,
            callbacks: [],
          });
          toast.success(`Deposit of ${formatMoney(res.amount)} is Pending`, 'Send the PSP callback to settle it.');
          return { ok: true, value: { id: res.id, pspRef: res.pspRef } };
        } catch (err) {
          const out = failure<{ id: string; pspRef: string }>(err);
          toast.error('Deposit rejected', out.ok ? undefined : out.error);
          return out;
        }
      }),

    sendCallback: ({ pspRef, status, amount }, opts) =>
      track('sendCallback', async () => {
        const quiet = opts?.quiet ?? false;
        const txs = useTransactionStore.getState();
        const known = txs.deposits.find((d) => d.pspRef === pspRef) ?? null;
        const delivery: CallbackDelivery = {
          id: newId(),
          sentAt: new Date().toISOString(),
          requestedStatus: status,
          requestedAmount: amount,
          httpStatus: null,
          applied: null,
          errorCode: null,
        };
        try {
          const res = await api.pspCallback({ pspRef, status, amount });
          if (known) {
            txs.updateDeposit(known.id, {
              status: res.status,
              settledAmount: res.settledAmount,
              amountMismatch: res.amountMismatch,
            });
            txs.addCallbackDelivery(pspRef, { ...delivery, httpStatus: 200, applied: res.applied });
            if (res.applied) await silentRefresh(known.memberId);
          }
          if (quiet) {
            return { ok: true, value: res };
          }
          if (res.applied) {
            toast.success(
              `Deposit ${res.status.toLowerCase()}`,
              res.status === 'Completed'
                ? `Wallet credited ${formatMoney(res.settledAmount)}${res.amountMismatch ? ' (amount differs from the deposit, flagged for reconciliation)' : ''}.`
                : 'Nothing was credited.',
            );
          } else {
            toast.info('Duplicate callback acknowledged', 'The API returned 200 with applied=false. No second credit.');
          }
          return { ok: true, value: res };
        } catch (err) {
          const out = failure<PspCallbackResponse>(err);
          if (known) {
            txs.addCallbackDelivery(pspRef, {
              ...delivery,
              httpStatus: isApiError(err) ? err.status : null,
              errorCode: isApiError(err) ? err.code : 'network_error',
            });
          }
          if (!quiet) toast.error('Callback rejected', out.ok ? undefined : out.error);
          return out;
        }
      }),

    sendCallbackBurst: async ({ pspRef, status, amount, count }) =>
      track('burst', async () => {
        const n = Math.max(2, Math.min(20, count));
        const results = await Promise.all(
          Array.from({ length: n }, () => get().sendCallback({ pspRef, status, amount }, { quiet: true })),
        );
        const applied = results.filter((r) => r.ok && r.value.applied).length;
        const acknowledged = results.filter((r) => r.ok && !r.value.applied).length;
        const rejected = results.filter((r) => !r.ok).length;
        toast.info(
          `${n} concurrent deliveries finished`,
          `${applied} applied, ${acknowledged} acknowledged as duplicates, ${rejected} rejected.`,
        );
        return results;
      }),

    placeWager: (amount) =>
      track('placeWager', async () => {
        const active = requireActive();
        if (!active) return { ok: false, error: 'No member selected.', code: null, status: null };
        try {
          const res = await api.placeWager(active.walletId, { amount });
          useSessionStore.getState().patchWallet(active.memberId, { balance: res.balance, turnoverAccrued: res.turnoverAccrued });
          useTransactionStore.getState().addWager({
            id: newId(),
            memberId: active.memberId,
            walletId: active.walletId,
            amount,
            balanceAfter: res.balance,
            turnoverAccruedAfter: res.turnoverAccrued,
            createdAt: new Date().toISOString(),
          });
          return { ok: true, value: { balance: res.balance, turnoverAccrued: res.turnoverAccrued } };
        } catch (err) {
          return failure<{ balance: string; turnoverAccrued: string }>(err);
        }
      }),

    placeWagerBurst: async (amount, count) =>
      track('burst', async () => {
        const active = requireActive();
        if (!active) return [];
        const n = Math.max(2, Math.min(20, count));
        const results = await Promise.all(Array.from({ length: n }, () => get().placeWager(amount)));
        // Parallel responses land in any order, so the last patchWallet may not be the
        // latest balance. One authoritative read fixes that.
        await silentRefresh(active.memberId);
        const accepted = results.filter((r) => r.ok).length;
        const insufficient = results.filter((r) => !r.ok && r.code === 'insufficient_balance').length;
        const other = results.length - accepted - insufficient;
        toast.info(
          `${n} concurrent wagers finished`,
          `${accepted} accepted, ${insufficient} rejected for insufficient balance${other ? `, ${other} failed otherwise` : ''}.`,
        );
        return results;
      }),

    createWithdrawal: (amount) =>
      track('createWithdrawal', async () => {
        const active = requireActive();
        if (!active) return { ok: false, error: 'No member selected.', code: null, status: null };
        try {
          const res = await api.createWithdrawal({ memberId: active.memberId, amount });
          useSessionStore.getState().patchWallet(active.memberId, { balance: res.balance });
          useTransactionStore.getState().addWithdrawal({
            id: res.id,
            memberId: active.memberId,
            amount: res.amount,
            status: res.status,
            balanceAfter: res.balance,
            createdAt: new Date().toISOString(),
          });
          toast.success(`Withdrawal of ${formatMoney(res.amount)} is Pending`, `Balance is now ${formatMoney(res.balance)}. Payout awaits approval.`);
          return { ok: true, value: { id: res.id, balance: res.balance } };
        } catch (err) {
          return failure<{ id: string; balance: string }>(err);
        }
      }),
  };
});

export const selectBusy = (key: OperationKey) => (s: OperationsState) => (s.busy[key] ?? 0) > 0;
