import { formatMoney } from '@/lib/money';

interface MoneyProps {
  value: string | null | undefined;
  className?: string;
  // Show the full 18-decimal string on hover.
  exact?: boolean;
}

export function Money({ value, className = '', exact = true }: MoneyProps) {
  return (
    <span className={`tabular ${className}`} title={exact && value ? value : undefined}>
      {formatMoney(value)}
    </span>
  );
}
