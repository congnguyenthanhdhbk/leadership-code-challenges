// One error base class carrying an HTTP status and a stable machine-readable code.
// Services throw these; the error handler in app.ts maps them to responses.
// Routes never build error bodies themselves.
export class DomainError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = new.target.name;
  }

  toBody(): Record<string, unknown> {
    return { error: this.code, ...this.details };
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: 'member' | 'wallet' | 'pspRef', id: string) {
    super(404, 'not_found', { resource, id });
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(409, 'invalid_transition', { from, to });
  }
}

export class UnsupportedCallbackError extends DomainError {
  constructor(pspRef: string, kind: string) {
    super(409, 'unsupported_callback', { pspRef, kind, reason: 'callbacks are only handled for deposits' });
  }
}

export class InsufficientBalanceError extends DomainError {
  constructor(balance: string, requested: string) {
    super(422, 'insufficient_balance', { balance, requested });
  }
}

export class TurnoverNotMetError extends DomainError {
  constructor(required: string, accrued: string, outstanding: string) {
    super(422, 'turnover_not_met', { required, accrued, outstanding });
  }
}
