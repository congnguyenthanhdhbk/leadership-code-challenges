import BigNumber from 'bignumber.js';

// Money invariants for this codebase:
// - Money is stored as DECIMAL(36,18) in Postgres and travels as strings in JS/JSON.
// - All arithmetic on money MUST go through BigNumber. Never use JS number math on money.
BigNumber.config({ DECIMAL_PLACES: 18, ROUNDING_MODE: BigNumber.ROUND_DOWN });

export function dec(value: string | number | BigNumber): BigNumber {
  const bn = new BigNumber(value);
  if (!bn.isFinite()) {
    throw new Error(`Invalid money value: ${value}`);
  }
  return bn;
}

export const ZERO = dec(0);

// Column precision. Anything with more fractional digits cannot be stored exactly and is
// rejected at the API edge (see lib/validation.ts) rather than rounded silently.
export const MONEY_SCALE = 18;

// Canonical string form for writing to the DB and for API responses: fixed 18 decimal
// places, never exponential notation. This matches what pg returns for DECIMAL(36,18),
// so a value computed here and a value read back compare equal as strings.
export function toMoney(value: string | BigNumber): string {
  return dec(value).toFixed(MONEY_SCALE);
}
