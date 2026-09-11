import { isApiError } from './api/client';
import { formatMoney } from './money';

// Turn an API error into one sentence a person can act on. Codes come from
// starter/src/lib/errors.ts and the zod handler in starter/src/app.ts.
export function describeError(err: unknown): string {
  if (!isApiError(err)) {
    return err instanceof Error ? err.message : 'Something went wrong.';
  }

  const b = err.body;
  switch (err.code) {
    case 'validation_error': {
      const first = b.details?.[0];
      if (first) {
        const field = first.path.length ? first.path.join('.') : 'input';
        return `Invalid ${field}: ${first.message}`;
      }
      return 'The API rejected the request as invalid.';
    }
    case 'not_found':
      return `${capitalise(b.resource ?? 'resource')} ${shorten(b.id)} was not found.`;
    case 'invalid_transition':
      return `Deposit is already ${b.from}; it cannot move to ${b.to}.`;
    case 'unsupported_callback':
      return `Callbacks are only handled for deposits; ${shorten(b.pspRef)} is a ${b.kind}.`;
    case 'insufficient_balance':
      return `Insufficient balance: ${formatMoney(b.balance)} available, ${formatMoney(b.requested)} requested.`;
    case 'turnover_not_met':
      return `Turnover not met: ${formatMoney(b.outstanding)} still outstanding (${formatMoney(b.accrued)} of ${formatMoney(b.required)} accrued).`;
    case 'network_error':
      return 'Could not reach the API. Is the wallet service running on the configured API_URL?';
    case 'internal_error':
      return 'The API hit an internal error. Check its logs.';
    default:
      if (err.status === 404 && typeof b.error === 'string') return b.error;
      return `Request failed with ${err.status || 'no response'}: ${String(b.error)}`;
  }
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function shorten(id: string | undefined | null, keep = 8): string {
  if (!id) return '';
  return id.length > keep + 1 ? `${id.slice(0, keep)}…` : id;
}
