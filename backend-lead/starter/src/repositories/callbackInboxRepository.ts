import { PspCallback, PspCallbackOutcome } from '../db/models';

// Raw inbox of PSP deliveries. `record` runs before the money transaction opens and on
// its own connection, so a crash mid-processing still leaves a `received` row behind.
export class CallbackInboxRepository {
  record(pspRef: string, payload: unknown): Promise<PspCallback> {
    return PspCallback.create({
      pspRef,
      payload: payload as Record<string, unknown>,
      outcome: 'received',
    });
  }

  markOutcome(row: PspCallback, outcome: PspCallbackOutcome): Promise<PspCallback> {
    return row.update({ outcome, processedAt: new Date() });
  }
}
