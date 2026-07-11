import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

import styles from './Brand.module.css';

export interface BrandProps extends HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
}

export function Brand({ compact = false, className, ...props }: BrandProps) {
  return (
    <div {...props} className={cn(styles.lockup, className)}>
      <span
        className={cn(styles.mark, compact && styles.compactMark)}
        aria-hidden="true"
      >
        <span className={cn(styles.card, styles.backCard)} />
        <span className={cn(styles.card, styles.frontCard)}>M</span>
      </span>
      <span className={styles.copy}>
        <span className={cn(styles.name, compact && styles.compactName)}>
          Monikers
        </span>
        {!compact && (
          <span className={styles.tagline}>Permainan tebak nama</span>
        )}
      </span>
    </div>
  );
}
