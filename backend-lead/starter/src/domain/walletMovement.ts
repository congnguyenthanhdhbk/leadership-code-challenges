import type BigNumber from 'bignumber.js';
import type { WalletTxKind } from '../db/models';

// A request to change a wallet balance. `amount` is a positive magnitude; the sign is
// derived from the kind so a caller cannot post a "credit" that debits by mistake.
export interface WalletMovement {
  kind: WalletTxKind;
  amount: BigNumber;
  fundingTxId?: string | null;
  turnoverRequiredDelta?: BigNumber;
  turnoverAccruedDelta?: BigNumber;
}

const CREDIT_KINDS: ReadonlySet<WalletTxKind> = new Set<WalletTxKind>(['deposit_credit']);

export function isCredit(kind: WalletTxKind): boolean {
  return CREDIT_KINDS.has(kind);
}

export function signedAmount(movement: WalletMovement): BigNumber {
  return isCredit(movement.kind) ? movement.amount : movement.amount.negated();
}
