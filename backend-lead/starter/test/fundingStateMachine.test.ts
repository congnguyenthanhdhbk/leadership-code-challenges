import { isTerminal, transition } from '../src/domain/fundingStateMachine';
import { InvalidTransitionError } from '../src/lib/errors';

describe('funding transaction state machine', () => {
  it('allows Pending to reach either terminal state', () => {
    expect(transition('Pending', 'Completed')).toBe('apply');
    expect(transition('Pending', 'Failed')).toBe('apply');
  });

  it('treats a repeat of the current state as a no-op', () => {
    expect(transition('Completed', 'Completed')).toBe('noop');
    expect(transition('Failed', 'Failed')).toBe('noop');
  });

  it('rejects leaving a terminal state', () => {
    expect(() => transition('Completed', 'Failed')).toThrow(InvalidTransitionError);
    expect(() => transition('Failed', 'Completed')).toThrow(InvalidTransitionError);
    expect(() => transition('Completed', 'Pending')).toThrow(InvalidTransitionError);
    expect(() => transition('Failed', 'Pending')).toThrow(InvalidTransitionError);
  });

  it('carries from/to in the error for the 409 body', () => {
    try {
      transition('Completed', 'Failed');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidTransitionError);
      expect((err as InvalidTransitionError).status).toBe(409);
      expect((err as InvalidTransitionError).toBody()).toEqual({
        error: 'invalid_transition',
        from: 'Completed',
        to: 'Failed',
      });
    }
  });

  it('knows which states are terminal', () => {
    expect(isTerminal('Pending')).toBe(false);
    expect(isTerminal('Completed')).toBe(true);
    expect(isTerminal('Failed')).toBe(true);
  });
});
