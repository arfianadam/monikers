import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

import styles from './TopBar.module.css';

export interface TopBarProps extends HTMLAttributes<HTMLElement> {
  note?: ReactNode;
}

export function TopBar({ children, className, note, ...props }: TopBarProps) {
  return (
    <header {...props} className={cn(styles.topBar, className)}>
      {children}
      {note !== undefined && <p className={styles.note}>{note}</p>}
    </header>
  );
}
