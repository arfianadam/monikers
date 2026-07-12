import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

import styles from './TopBar.module.css';

export interface TopBarProps extends HTMLAttributes<HTMLElement> {
  meta?: ReactNode;
  note?: ReactNode;
  trailing?: ReactNode;
}

export function TopBar({
  children,
  className,
  meta,
  note,
  trailing,
  ...props
}: TopBarProps) {
  return (
    <header
      {...props}
      className={cn(
        styles.topBar,
        trailing !== undefined && styles.withTrailing,
        className
      )}
    >
      {children}
      {(note !== undefined || meta !== undefined || trailing !== undefined) && (
        <div className={styles.trailing}>
          {note !== undefined && <p className={styles.note}>{note}</p>}
          {meta !== undefined && <div className={styles.meta}>{meta}</div>}
          {trailing}
        </div>
      )}
    </header>
  );
}
