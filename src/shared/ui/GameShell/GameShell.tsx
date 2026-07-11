import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

import styles from './GameShell.module.css';

export type GameShellVariant =
  'setup' | 'handoff' | 'selection' | 'turn' | 'play' | 'score';

export interface GameShellProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  children: ReactNode;
  final?: boolean;
  team?: 1 | 2;
  variant?: GameShellVariant;
}

export function GameShell({
  children,
  className,
  final = false,
  team,
  variant,
  ...props
}: GameShellProps) {
  return (
    <div
      {...props}
      className={cn(
        styles.shell,
        team === 1 && styles.teamOne,
        team === 2 && styles.teamTwo,
        className
      )}
      data-final={final || undefined}
      data-team={team}
      data-variant={variant}
    >
      <div
        className={cn(
          styles.shape,
          styles.coralShape,
          variant === 'turn' && styles.turnCoralShape
        )}
        aria-hidden="true"
      />
      <div className={cn(styles.shape, styles.cyanShape)} aria-hidden="true" />
      {children}
    </div>
  );
}
