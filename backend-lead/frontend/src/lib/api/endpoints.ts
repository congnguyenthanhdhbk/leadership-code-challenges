import { request } from './client';
import type {
  CreateDepositRequest,
  CreateDepositResponse,
  CreateMemberRequest,
  CreateMemberResponse,
  CreateWithdrawalRequest,
  CreateWithdrawalResponse,
  HealthResponse,
  PspCallbackRequest,
  PspCallbackResponse,
  WagerRequest,
  WagerResponse,
  WalletResponse,
} from './types';

// One function per route. Keep this file boring: no state, no retries, no UI.
export const api = {
  health: () => request<HealthResponse>('GET', '/health'),

  createMember: (body: CreateMemberRequest) => request<CreateMemberResponse>('POST', '/members', body),

  getWallet: (memberId: string) =>
    request<WalletResponse>('GET', `/members/${encodeURIComponent(memberId)}/wallet`),

  createDeposit: (body: CreateDepositRequest) => request<CreateDepositResponse>('POST', '/deposits', body),

  pspCallback: (body: PspCallbackRequest) => request<PspCallbackResponse>('POST', '/psp/callbacks', body),

  placeWager: (walletId: string, body: WagerRequest) =>
    request<WagerResponse>('POST', `/wallets/${encodeURIComponent(walletId)}/wagers`, body),

  createWithdrawal: (body: CreateWithdrawalRequest) =>
    request<CreateWithdrawalResponse>('POST', '/withdrawals', body),
};
