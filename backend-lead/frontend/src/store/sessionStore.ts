import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Money, WalletResponse } from '@/lib/api/types';
import { persistOptions } from './persist';

export interface Member {
  id: string;
  username: string;
  walletId: string;
  createdAt: string;
}

export interface WalletSnapshot {
  id: string;
  memberId: string;
  balance: Money;
  turnoverRequired: Money;
  turnoverAccrued: Money;
  fetchedAt: string;
}

interface SessionState {
  members: Member[];
  activeMemberId: string | null;
  wallets: Record<string, WalletSnapshot>;

  addMember: (member: Member, wallet: { id: string; balance: Money }) => void;
  setActiveMember: (memberId: string | null) => void;
  removeMember: (memberId: string) => void;
  setWallet: (wallet: WalletResponse) => void;
  // Partial update from a response that only carries some wallet fields (wager,
  // withdrawal). Keeps the rest of the snapshot as it was.
  patchWallet: (memberId: string, patch: Partial<Pick<WalletSnapshot, 'balance' | 'turnoverAccrued' | 'turnoverRequired'>>) => void;
  reset: () => void;
}

const initial = { members: [] as Member[], activeMemberId: null as string | null, wallets: {} as Record<string, WalletSnapshot> };

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...initial,

      addMember: (member, wallet) =>
        set((s) => ({
          members: [member, ...s.members.filter((m) => m.id !== member.id)],
          activeMemberId: member.id,
          wallets: {
            ...s.wallets,
            [member.id]: {
              id: wallet.id,
              memberId: member.id,
              balance: wallet.balance,
              turnoverRequired: '0.000000000000000000',
              turnoverAccrued: '0.000000000000000000',
              fetchedAt: new Date().toISOString(),
            },
          },
        })),

      setActiveMember: (memberId) => set({ activeMemberId: memberId }),

      removeMember: (memberId) =>
        set((s) => {
          const members = s.members.filter((m) => m.id !== memberId);
          const wallets = { ...s.wallets };
          delete wallets[memberId];
          return {
            members,
            wallets,
            activeMemberId: s.activeMemberId === memberId ? (members[0]?.id ?? null) : s.activeMemberId,
          };
        }),

      setWallet: (wallet) =>
        set((s) => ({
          wallets: {
            ...s.wallets,
            [wallet.memberId]: {
              id: wallet.id,
              memberId: wallet.memberId,
              balance: wallet.balance,
              turnoverRequired: wallet.turnoverRequired,
              turnoverAccrued: wallet.turnoverAccrued,
              fetchedAt: new Date().toISOString(),
            },
          },
        })),

      patchWallet: (memberId, patch) =>
        set((s) => {
          const current = s.wallets[memberId];
          if (!current) return s;
          return {
            wallets: { ...s.wallets, [memberId]: { ...current, ...patch, fetchedAt: new Date().toISOString() } },
          };
        }),

      reset: () => set({ ...initial }),
    }),
    persistOptions<SessionState>('session', (s) => ({
      members: s.members,
      activeMemberId: s.activeMemberId,
      wallets: s.wallets,
    })),
  ),
);

// Selectors. Keep them here so components do not re-derive the same shape.
export const selectActiveMember = (s: SessionState): Member | null =>
  s.members.find((m) => m.id === s.activeMemberId) ?? null;

export const selectActiveWallet = (s: SessionState): WalletSnapshot | null =>
  s.activeMemberId ? (s.wallets[s.activeMemberId] ?? null) : null;
