import { z } from 'zod';
import { dec, MONEY_SCALE } from './money';

// A positive decimal amount as a string, with at most 18 fractional digits.
// Rejects: signs, exponents, thousands separators, leading dots, zero, and anything the
// DECIMAL(36,18) column could not hold exactly.
const AMOUNT_PATTERN = new RegExp(`^\\d{1,18}(\\.\\d{1,${MONEY_SCALE}})?$`);

export const positiveAmount = z
  .string()
  .regex(AMOUNT_PATTERN, `amount must be a decimal string with at most ${MONEY_SCALE} fractional digits`)
  // Zod runs refinements even when the regex check failed, so guard before parsing.
  .refine((v) => !AMOUNT_PATTERN.test(v) || dec(v).isGreaterThan(0), 'amount must be positive');

export const uuid = z.string().uuid();

export const turnoverMultiplier = z.number().int().min(0).default(1);
