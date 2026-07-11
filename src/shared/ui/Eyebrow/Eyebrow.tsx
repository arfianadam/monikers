import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

import styles from './Eyebrow.module.css';

export interface EyebrowProps extends HTMLAttributes<HTMLParagraphElement> {
  dot?: boolean;
  onDark?: boolean;
}

export function Eyebrow({
  children,
  className,
  dot = false,
  onDark = false,
  ...props
}: EyebrowProps) {
  return (
    <p
      {...props}
      className={cn(styles.eyebrow, onDark && styles.onDark, className)}
    >
      {dot && <span className={styles.dot} />}
      {children}
    </p>
  );
}
