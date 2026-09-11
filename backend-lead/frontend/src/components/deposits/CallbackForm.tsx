'use client';

import { useState, type FormEvent } from 'react';
import { AmountInput } from '@/components/forms/AmountInput';
import { ErrorNote } from '@/components/forms/ErrorNote';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import type { CallbackStatus } from '@/lib/api/types';
import { validateAmount, validatePspRef } from '@/lib/validation';
import { useOperationsStore, selectBusy } from '@/store/operationsStore';

// Free-form PSP callback. Lets you replay a delivery for any reference, including ones
// this browser never created, to see the 404 for an unknown pspRef or the 409 for a
// conflicting terminal state.
export function CallbackForm({ initialPspRef = '' }: { initialPspRef?: string }) {
  const [pspRef, setPspRef] = useState(initialPspRef);
  const [status, setStatus] = useState<CallbackStatus>('completed');
  const [amount, setAmount] = useState('100.00');
  const [concurrency, setConcurrency] = useState('1');
  const [errors, setErrors] = useState<{ pspRef?: string; amount?: string; form?: string }>({});

  const sendCallback = useOperationsStore((s) => s.sendCallback);
  const sendBurst = useOperationsStore((s) => s.sendCallbackBurst);
  const busy = useOperationsStore(selectBusy('sendCallback'));
  const bursting = useOperationsStore(selectBusy('burst'));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = validatePspRef(pspRef);
    const a = validateAmount(amount);
    const next: typeof errors = {};
    if (!r.ok) next.pspRef = r.message;
    if (!a.ok) next.amount = a.message;
    setErrors(next);
    if (!r.ok || !a.ok) return;

    const n = Math.max(1, Math.min(20, Number(concurrency) || 1));
    if (n > 1) {
      await sendBurst({ pspRef: r.value, status, amount: a.value, count: n });
      return;
    }
    const out = await sendCallback({ pspRef: r.value, status, amount: a.value });
    if (!out.ok) setErrors({ form: out.error });
  };

  return (
    <Card
      title="Simulate a PSP callback"
      description="Acts as the payment provider's webhook. Send it for any reference, as often and as concurrently as you like."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="PSP reference" htmlFor="cb-pspref" error={errors.pspRef} hint="The pspRef returned when the deposit was created. Unknown references get a 404.">
          <Input id="cb-pspref" mono value={pspRef} onChange={(e) => setPspRef(e.target.value)} placeholder="8f9c2b1e-…" invalid={Boolean(errors.pspRef)} autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <Field label="Status" htmlFor="cb-status" hint="completed credits the wallet; failed only closes the deposit.">
            <Select id="cb-status" value={status} onChange={(e) => setStatus(e.target.value as CallbackStatus)}>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
            </Select>
          </Field>
          <Field label="Concurrent deliveries" htmlFor="cb-concurrency" hint="Above 1 fires identical requests in parallel.">
            <Input id="cb-concurrency" inputMode="numeric" value={concurrency} onChange={(e) => setConcurrency(e.target.value)} className="tabular" />
          </Field>
        </div>
        <AmountInput
          id="cb-amount"
          label="Settled amount"
          value={amount}
          onChange={setAmount}
          error={errors.amount}
          hint="What the PSP says actually moved. A value different from the deposit amount is credited as-is and flagged amountMismatch."
        />
        {errors.form ? <ErrorNote title="Callback rejected">{errors.form}</ErrorNote> : null}
        <div className="flex justify-end">
          <Button type="submit" loading={busy || bursting}>
            Send callback
          </Button>
        </div>
      </form>
    </Card>
  );
}
