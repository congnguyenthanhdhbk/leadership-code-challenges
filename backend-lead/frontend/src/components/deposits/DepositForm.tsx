'use client';

import { useState, type FormEvent } from 'react';
import { AmountInput } from '@/components/forms/AmountInput';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Id } from '@/components/ui/CopyButton';
import { Field, Input } from '@/components/ui/Field';
import { Money } from '@/components/ui/Money';
import { validateAmount, validateTurnoverMultiplier } from '@/lib/validation';
import { useOperationsStore, selectBusy } from '@/store/operationsStore';

export function DepositForm() {
  const [amount, setAmount] = useState('100.00');
  const [multiplier, setMultiplier] = useState('1');
  const [errors, setErrors] = useState<{ amount?: string; multiplier?: string; form?: string }>({});
  const [last, setLast] = useState<{ id: string; pspRef: string; amount: string } | null>(null);

  const createDeposit = useOperationsStore((s) => s.createDeposit);
  const busy = useOperationsStore(selectBusy('createDeposit'));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const a = validateAmount(amount);
    const m = validateTurnoverMultiplier(multiplier);
    const next: typeof errors = {};
    if (!a.ok) next.amount = a.message;
    if (!m.ok) next.multiplier = m.message;
    setErrors(next);
    if (!a.ok || !m.ok) return;

    const out = await createDeposit({ amount: a.value, turnoverMultiplier: m.value });
    if (out.ok) {
      setLast({ ...out.value, amount: a.value });
    } else {
      setErrors({ form: out.error });
    }
  };

  const previewRequirement = (() => {
    const a = validateAmount(amount);
    const m = validateTurnoverMultiplier(multiplier);
    if (!a.ok || !m.ok) return null;
    return { amount: a.value, multiplier: m.value };
  })();

  return (
    <Card title="Create a deposit" description="Creates a Pending funding transaction and returns a PSP reference. Nothing is credited until the callback arrives.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <AmountInput id="deposit-amount" value={amount} onChange={setAmount} error={errors.amount} presets={['10.00', '50.00', '100.00', '250.00']} />
        <Field
          label="Turnover multiplier"
          htmlFor="deposit-multiplier"
          error={errors.multiplier}
          hint={
            previewRequirement ? (
              <>
                On completion this adds a turnover requirement of <Money value={previewRequirement.amount} /> × {previewRequirement.multiplier}.
                {previewRequirement.multiplier === 0 ? ' A 0× deposit adds no requirement.' : ''}
              </>
            ) : (
              'Whole number, 0 or more. Default 1.'
            )
          }
        >
          <div className="flex gap-2">
            <Input
              id="deposit-multiplier"
              inputMode="numeric"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              invalid={Boolean(errors.multiplier)}
              className="tabular w-28"
            />
            <div className="flex flex-wrap gap-1.5">
              {['0', '1', '2', '3'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMultiplier(m)}
                  className={`tabular rounded-md border px-2.5 text-xs transition-colors ${
                    multiplier === m ? 'border-accent bg-accent-soft text-accent' : 'border-border text-fg-muted hover:bg-surface-muted'
                  }`}
                >
                  {m}×
                </button>
              ))}
            </div>
          </div>
        </Field>

        {errors.form ? (
          <p className="text-xs text-danger" role="alert">
            {errors.form}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <Button type="submit" loading={busy}>
            Create deposit
          </Button>
        </div>
      </form>

      {last ? (
        <div className="mt-4 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs">
          <p className="font-semibold text-warning">
            Pending deposit of <Money value={last.amount} /> created
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-fg-muted">
            <span>
              pspRef <Id value={last.pspRef} keep={13} />
            </span>
            <span>
              id <Id value={last.id} />
            </span>
          </p>
          <p className="mt-1 text-fg-muted">Settle it from the list below, or paste the pspRef into the manual callback form.</p>
        </div>
      ) : null}
    </Card>
  );
}
