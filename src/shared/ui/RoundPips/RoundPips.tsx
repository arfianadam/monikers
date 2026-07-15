import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

import styles from './RoundPips.module.css';

export interface RoundPipsProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  final?: boolean;
  label?: boolean;
  round: number;
}

export function RoundPips({
  'aria-label': ariaLabel,
  className,
  final = false,
  label = true,
  round,
  ...props
}: RoundPipsProps) {
  return (
    <div
      {...props}
      className={cn(styles.pips, className)}
      aria-label={ariaLabel ?? `Ronde ${round} dari 3`}
    >
      {label && <span className={styles.label}>Ronde</span>}
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={cn(
            styles.pip,
            step === round && styles.active,
            step === round && final && styles.finalActive,
            step < round && styles.complete
          )}
        >
          {step}
        </span>
      ))}
    </div>
  );
}
