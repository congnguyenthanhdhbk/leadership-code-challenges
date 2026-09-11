'use client';

import { useState, type FormEvent } from 'react';
import { AmountInput } from '@/components/forms/AmountInput';
import { ErrorNote } from '@/components/forms/ErrorNote';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { compare, isZero, outstandingTurnover } from '@/lib/money';
import { validateAmount } from '@/lib/validation';
import { useOperationsStore, selectBusy } from '@/store/operationsStore';
import { useSessionStore, selectActiveWallet } from '@/store/sessionStore';
import { TurnoverGauge } from '@/components/wallet/TurnoverGauge';

export function WithdrawalForm() {
  const [amount, setAmount] = useState('50.00');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<{ title: string; detail: string; tone: 'danger' | 'warning' } | null>(null);

  const wallet = useSessionStore(selectActiveWallet);
  const createWithdrawal = useOperationsStore((s) => s.createWithdrawal);
  const busy = useOperationsStore(selectBusy('createWithdrawal'));

  const met = wallet ? compare(wallet.turnoverAccrued, wallet.turnoverRequired) >= 0 : false;
  const outstanding = wallet ? outstandingTurnover(wallet.turnoverRequired, wallet.turnoverAccrued) : '0';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const a = validateAmount(amount);
    setError(a.ok ? null : a.message);
    if (!a.ok) return;
    setFormError(null);
    const out = await createWithdrawal(a.value);
    if (!out.ok) {
      setFormError({
        title:
          out.code === 'turnover_not_met'
            ? 'Blocked by the turnover lock'
            : out.code === 'insufficient_balance'
              ? 'Insufficient balance'
              : 'Withdrawal rejected',
        detail: out.error,
        tone: out.code === 'turnover_not_met' ? 'warning' : 'danger',
      });
    }
  };

  return (
    <Card
      title="Request a withdrawal"
      description="Checks the turnover requirement first, then the balance. A valid request debits the wallet now and creates a Pending payout for later approval."
    >
      {wallet ? (
        <div className="mb-4 rounded-md border border-border bg-surface-muted/60 p-4">
          <TurnoverGauge required={wallet.turnoverRequired} accrued={wallet.turnoverAccrued} />
          <p className={`mt-3 text-xs ${met ? 'text-success' : 'text-warning'}`}>
            {isZero(wallet.turnoverRequired)
              ? 'No turnover requirement on this wallet. Withdrawals are limited by balance only.'
              : met
                ? 'Turnover requirement met. Withdrawals up to the balance are allowed.'
                : <>The API will answer 422 turnover_not_met until <Money value={outstanding} /> more has been wagered.</>}
          </p>
        </div>
      ) : null}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <AmountInput
          id="withdrawal-amount"
          value={amount}
          onChange={setAmount}
          error={error}
          presets={['10.00', '25.00', '50.00', '100.00']}
          hint={wallet ? <>Available balance <Money value={wallet.balance} className="text-fg" />.</> : undefined}
        />
        {formError ? (
          <ErrorNote title={formError.title} tone={formError.tone}>
            {formError.detail}
          </ErrorNote>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            Request withdrawal
          </Button>
        </div>
      </form>
    </Card>
  );
}
