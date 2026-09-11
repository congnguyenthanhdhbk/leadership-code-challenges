// Money helpers for the frontend. Same invariant as the API: amounts are decimal strings
// and never touch a JS number. Arithmetic here uses BigInt on an 18-decimal fixed scale,
// which is exact for anything the DECIMAL(36,18) column can hold.

export const MONEY_SCALE = 18;
const SCALE_FACTOR = 10n ** BigInt(MONEY_SCALE);

// Mirrors starter/src/lib/validation.ts: 1-18 integer digits, optional fraction of
// 1-18 digits, no sign, no exponent, no separators.
export const AMOUNT_PATTERN = new RegExp(`^\\d{1,18}(\\.\\d{1,${MONEY_SCALE}})?$`);

export function isValidAmountFormat(value: string): boolean {
  return AMOUNT_PATTERN.test(value);
}

// Parse a decimal string into a scaled BigInt. Throws on anything the pattern rejects.
export function toScaled(value: string): bigint {
  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  if (!AMOUNT_PATTERN.test(unsigned)) {
    throw new Error(`Invalid money value: ${value}`);
  }
  const [whole, fraction = ''] = unsigned.split('.');
  const scaled = BigInt(whole) * SCALE_FACTOR + BigInt(fraction.padEnd(MONEY_SCALE, '0'));
  return negative ? -scaled : scaled;
}

// Canonical fixed 18-decimal string, the same shape the API returns.
export function fromScaled(scaled: bigint): string {
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const whole = abs / SCALE_FACTOR;
  const fraction = (abs % SCALE_FACTOR).toString().padStart(MONEY_SCALE, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export function isPositiveAmount(value: string): boolean {
  return isValidAmountFormat(value) && toScaled(value) > 0n;
}

export function subtract(a: string, b: string): string {
  return fromScaled(toScaled(a) - toScaled(b));
}

export function add(a: string, b: string): string {
  return fromScaled(toScaled(a) + toScaled(b));
}

export function compare(a: string, b: string): -1 | 0 | 1 {
  const x = toScaled(a);
  const y = toScaled(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function isZero(value: string): boolean {
  return toScaled(value) === 0n;
}

export function max(a: string, b: string): string {
  return compare(a, b) >= 0 ? a : b;
}

// Outstanding turnover, floored at zero, as the withdrawal gate computes it.
export function outstandingTurnover(required: string, accrued: string): string {
  const diff = toScaled(required) - toScaled(accrued);
  return fromScaled(diff > 0n ? diff : 0n);
}

// Ratio for progress bars only. Returns a number in [0, 1]; this is the one place a
// number is derived from money and it is never fed back into any amount.
export function ratio(part: string, whole: string): number {
  const p = toScaled(part);
  const w = toScaled(whole);
  if (w <= 0n) return 1;
  if (p <= 0n) return 0;
  if (p >= w) return 1;
  // Scale to basis points before converting to keep precision without overflow.
  return Number((p * 10000n) / w) / 10000;
}

// Display form: strip the 18-decimal padding down to at least `minFraction` digits, but
// never drop a significant digit.
export function formatMoney(value: string | null | undefined, minFraction = 2): string {
  if (value === null || value === undefined || value === '') return '—';
  let scaled: bigint;
  try {
    scaled = toScaled(value);
  } catch {
    return value;
  }
  const canonical = fromScaled(scaled);
  const [whole, fraction] = canonical.split('.');
  const trimmedFraction = fraction.replace(/0+$/, '');
  const shown = trimmedFraction.length < minFraction ? trimmedFraction.padEnd(minFraction, '0') : trimmedFraction;
  const wholeWithGroups = whole.replace(/^(-?)(\d+)$/, (_m, sign: string, digits: string) =>
    sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ','),
  );
  return shown.length === 0 ? wholeWithGroups : `${wholeWithGroups}.${shown}`;
}

// Normalise user input like "100" or "100.5" into the form the API expects. Returns null
// when the input is not a valid positive amount.
export function normaliseAmountInput(raw: string): string | null {
  const value = raw.trim().replace(/,/g, '');
  if (value.startsWith('.')) {
    return normaliseAmountInput(`0${value}`);
  }
  if (!isPositiveAmount(value)) return null;
  return value;
}
