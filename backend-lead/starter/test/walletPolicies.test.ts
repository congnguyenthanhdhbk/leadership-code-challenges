import { dec } from '../src/lib/money';
import { InsufficientBalanceError, TurnoverNotMetError } from '../src/lib/errors';
import { SufficientBalancePolicy, TurnoverMetPolicy } from '../src/domain/walletPolicies';
import { money } from './helpers';

// Pure unit tests: no database. The policies read three strings and throw or return.
const snapshot = (balance: string, turnoverRequired: string, turnoverAccrued: string) => ({
  balance: money(balance),
  turnoverRequired: money(turnoverRequired),
  turnoverAccrued: money(turnoverAccrued),
});

describe('TurnoverMetPolicy', () => {
  const policy = new TurnoverMetPolicy();

  it('passes when accrued equals or exceeds required', () => {
    expect(() => policy.check(snapshot('100', '100', '100'), dec('1'))).not.toThrow();
    expect(() => policy.check(snapshot('100', '100', '150'), dec('1'))).not.toThrow();
    expect(() => policy.check(snapshot('100', '0', '0'), dec('1'))).not.toThrow();
  });

  it('throws 422 turnover_not_met with the outstanding figure', () => {
    try {
      policy.check(snapshot('140', '100', '60'), dec('50'));
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TurnoverNotMetError);
      expect((err as TurnoverNotMetError).toBody()).toEqual({
        error: 'turnover_not_met',
        required: money('100'),
        accrued: money('60'),
        outstanding: money('40'),
      });
    }
  });

  it('ignores the requested amount: the gate is about turnover, not the withdrawal size', () => {
    expect(() => policy.check(snapshot('1', '10', '10'), dec('1000000'))).not.toThrow();
  });
});

describe('SufficientBalancePolicy', () => {
  const policy = new SufficientBalancePolicy();

  it('allows a debit up to and including the full balance', () => {
    expect(() => policy.check(snapshot('100', '0', '0'), dec('99.999999999999999999'))).not.toThrow();
    expect(() => policy.check(snapshot('100', '0', '0'), dec('100'))).not.toThrow();
  });

  it('throws 422 insufficient_balance with balance and requested', () => {
    try {
      policy.check(snapshot('100', '0', '0'), dec('100.000000000000000001'));
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientBalanceError);
      expect((err as InsufficientBalanceError).toBody()).toEqual({
        error: 'insufficient_balance',
        balance: money('100'),
        requested: '100.000000000000000001',
      });
    }
  });
});
