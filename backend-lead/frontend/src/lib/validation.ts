import { normaliseAmountInput } from './money';

// Client-side checks that mirror the API's zod schemas so the form can explain a
// problem before a round trip. The API remains the source of truth.

export type FieldResult<T> = { ok: true; value: T } | { ok: false; message: string };

export function validateUsername(raw: string): FieldResult<string> {
  const value = raw.trim();
  if (value.length < 3) return { ok: false, message: 'Username needs at least 3 characters.' };
  if (value.length > 64) return { ok: false, message: 'Username can be at most 64 characters.' };
  return { ok: true, value };
}

export function validateAmount(raw: string): FieldResult<string> {
  if (raw.trim() === '') return { ok: false, message: 'Enter an amount.' };
  const value = normaliseAmountInput(raw);
  if (value === null) {
    return {
      ok: false,
      message: 'Amount must be a positive decimal with at most 18 fractional digits, e.g. 100.50.',
    };
  }
  return { ok: true, value };
}

export function validateTurnoverMultiplier(raw: string): FieldResult<number> {
  const value = raw.trim();
  if (value === '') return { ok: true, value: 1 };
  if (!/^\d+$/.test(value)) return { ok: false, message: 'Turnover multiplier must be a whole number of 0 or more.' };
  const n = Number(value);
  if (!Number.isSafeInteger(n)) return { ok: false, message: 'Turnover multiplier is too large.' };
  return { ok: true, value: n };
}

export function validatePspRef(raw: string): FieldResult<string> {
  const value = raw.trim();
  if (value.length < 1) return { ok: false, message: 'Enter a PSP reference.' };
  if (value.length > 128) return { ok: false, message: 'PSP reference can be at most 128 characters.' };
  return { ok: true, value };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUuid(raw: string, label = 'id'): FieldResult<string> {
  const value = raw.trim();
  if (!UUID_PATTERN.test(value)) return { ok: false, message: `Enter a valid UUID for the ${label}.` };
  return { ok: true, value };
}
