// Wire types for the mini wallet API. These mirror the route handlers in
// starter/src/routes/* one-to-one. Money is always a string: the API returns fixed
// 18-decimal strings and accepts positive decimal strings.

export type Money = string;

export type FundingTxStatus = 'Pending' | 'Completed' | 'Failed';
export type CallbackStatus = 'completed' | 'failed';

// POST /members
export interface CreateMemberRequest {
  username: string;
}
export interface CreateMemberResponse {
  member: { id: string; username: string };
  wallet: { id: string; balance: Money };
}

// GET /members/:memberId/wallet
export interface WalletResponse {
  id: string;
  memberId: string;
  balance: Money;
  turnoverRequired: Money;
  turnoverAccrued: Money;
}

// POST /deposits
export interface CreateDepositRequest {
  memberId: string;
  amount: Money;
  turnoverMultiplier?: number;
}
export interface CreateDepositResponse {
  id: string;
  pspRef: string;
  status: FundingTxStatus;
  amount: Money;
  turnoverMultiplier: number;
}

// POST /psp/callbacks
export interface PspCallbackRequest {
  pspRef: string;
  status: CallbackStatus;
  amount: Money;
}
export interface PspCallbackResponse {
  id: string;
  pspRef: string;
  status: FundingTxStatus;
  amount: Money;
  settledAmount: Money | null;
  amountMismatch: boolean;
  // true when this delivery moved the deposit to its terminal state; false on an
  // idempotent retry of an outcome that was already applied.
  applied: boolean;
}

// POST /wallets/:walletId/wagers
export interface WagerRequest {
  amount: Money;
}
export interface WagerResponse {
  walletId: string;
  balance: Money;
  turnoverAccrued: Money;
}

// POST /withdrawals
export interface CreateWithdrawalRequest {
  memberId: string;
  amount: Money;
}
export interface CreateWithdrawalResponse {
  id: string;
  status: 'Pending';
  amount: Money;
  balance: Money;
}

// GET /health
export interface HealthResponse {
  status: 'ok';
}

// Error bodies. Every error carries a stable `error` code plus code-specific fields.
export type ApiErrorCode =
  | 'validation_error'
  | 'not_found'
  | 'invalid_transition'
  | 'unsupported_callback'
  | 'insufficient_balance'
  | 'turnover_not_met'
  | 'internal_error'
  // The frontend's own codes for failures that never reached the API.
  | 'network_error'
  | 'unexpected_response';

export interface ZodIssueLike {
  path: (string | number)[];
  message: string;
  code?: string;
}

export interface ApiErrorBody {
  error: ApiErrorCode | string;
  details?: ZodIssueLike[];
  resource?: 'member' | 'wallet' | 'pspRef';
  id?: string;
  from?: FundingTxStatus;
  to?: FundingTxStatus;
  pspRef?: string;
  kind?: string;
  reason?: string;
  balance?: Money;
  requested?: Money;
  required?: Money;
  accrued?: Money;
  outstanding?: Money;
  [key: string]: unknown;
}
