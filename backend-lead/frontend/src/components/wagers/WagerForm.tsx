'use client';

import { useState, type FormEvent } from 'react';
import { AmountInput } from '@/components/forms/AmountInput';
import { ErrorNote } from '@/components/forms/ErrorNote';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { Money } from '@/components/ui/Money';
import { formatMoney } from '@/lib/money';
import { validateAmount } from '@/lib/validation';
import { useOperationsStore, selectBusy } from '@/store/operationsStore';
import { useSessionStore, selectActiveWallet } from '@/store/sessionStore';
import { toast } from '@/store/toastStore';

export function WagerForm() {
  const [amount, setAmount] = useState('10.00');
  const [count, setCount] = useState('5');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<{ title: string; detail: string } | null>(null);

  const wallet = useSessionStore(selectActiveWallet);
  const placeWager = useOperationsStore((s) => s.placeWager);
  const placeBurst = useOperationsStore((s) => s.placeWagerBurst);
  const busy = useOperationsStore(selectBusy('placeWager'));
  const bursting = useOperationsStore(selectBusy('burst'));

  const validate = () => {
    const a = validateAmount(amount);
    setError(a.ok ? null : a.message);
    return a.ok ? a.value : null;
  };

  const single = async (e: FormEvent) => {
    e.preventDefault();
    const value = validate();
    if (!value) return;
    setFormError(null);
    const out = await placeWager(value);
    if (out.ok) {
      toast.success(`Wagered ${formatMoney(value)}`, `Balance ${formatMoney(out.value.balance)}, turnover accrued ${formatMoney(out.value.turnoverAccrued)}.`);
    } else {
      setFormError({ title: out.code === 'insufficient_balance' ? 'Insufficient balance' : 'Wager rejected', detail: out.error });
    }
  };

  const burst = async () => {
    const value = validate();
    if (!value) return;
    setFormError(null);
    const n = Math.max(2, Math.min(20, Number(count) || 2));
    await placeBurst(value, n);
  };

  return (
    <Card
      title="Place a wager"
      description="Debits the wallet under a row lock and accrues turnover equal to the stake. The API rejects anything the balance cannot cover."
    >
      <form onSubmit={single} className="flex flex-col gap-4">
        <AmountInput
          id="wager-amount"
          value={amount}
          onChange={setAmount}
          error={error}
          presets={['1.00', '5.00', '10.00', '25.00', '60.00']}
          hint={wallet ? <>Available balance <Money value={wallet.balance} className="text-fg" />.</> : undefined}
        />
        {formError ? <ErrorNote title={formError.title}>{formError.detail}</ErrorNote> : null}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Button type="submit" loading={busy && !bursting}>
            Wager
          </Button>
          <div className="flex items-end gap-2">
            <Field label="Concurrent wagers" htmlFor="wager-count">
              <Input id="wager-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} className="tabular w-20" />
            </Field>
            <Button variant="secondary" loading={bursting} onClick={() => void burst()} title="Fire the same wager N times in parallel">
              Fire burst
            </Button>
          </div>
        </div>
        <p className="text-xs text-fg-subtle">
          A burst sends identical wagers at once. Only as many as the balance covers should succeed; the rest come back 422 insufficient_balance
          and the balance never goes negative.
        </p>
      </form>
    </Card>
  );
}
