import { compare, isZero, outstandingTurnover, ratio } from '@/lib/money';
import { Money } from '@/components/ui/Money';

interface TurnoverGaugeProps {
  required: string;
  accrued: string;
  compact?: boolean;
}

// Visualises the withdrawal gate: accrued turnover against the total requirement.
export function TurnoverGauge({ required, accrued, compact = false }: TurnoverGaugeProps) {
  const met = compare(accrued, required) >= 0;
  const outstanding = outstandingTurnover(required, accrued);
  const pct = Math.round(ratio(accrued, required) * 100);
  const noRequirement = isZero(required);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-fg-muted">Turnover</span>
        <span className={`font-medium ${met ? 'text-success' : 'text-warning'}`}>
          {noRequirement ? 'No requirement' : met ? 'Requirement met' : <>Outstanding <Money value={outstanding} /></>}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Turnover accrued against requirement"
      >
        <div className={`h-full rounded-full transition-[width] duration-300 ${met ? 'bg-success' : 'bg-warning'}`} style={{ width: `${pct}%` }} />
      </div>
      {compact ? null : (
        <div className="flex items-center justify-between text-xs text-fg-subtle">
          <span>
            Accrued <Money value={accrued} className="text-fg" />
          </span>
          <span>
            Required <Money value={required} className="text-fg" />
          </span>
        </div>
      )}
    </div>
  );
}
