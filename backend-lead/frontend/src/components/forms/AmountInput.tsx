'use client';

import { Field, Input } from '@/components/ui/Field';

interface AmountInputProps {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: React.ReactNode;
  presets?: string[];
  disabled?: boolean;
  autoFocus?: boolean;
}

// Text input, not type=number: numbers would lose precision and the API wants a string.
export function AmountInput({ id, label = 'Amount', value, onChange, error, hint, presets, disabled, autoFocus }: AmountInputProps) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint ?? 'Positive decimal string, up to 18 fractional digits.'}>
      <div className="flex flex-col gap-2">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="100.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          invalid={Boolean(error)}
          disabled={disabled}
          autoFocus={autoFocus}
          className="tabular"
        />
        {presets && presets.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => onChange(p)}
                className={`tabular rounded-md border px-2 py-1 text-xs transition-colors ${
                  value === p ? 'border-accent bg-accent-soft text-accent' : 'border-border text-fg-muted hover:bg-surface-muted'
                } disabled:opacity-50`}
              >
                {p}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Field>
  );
}
