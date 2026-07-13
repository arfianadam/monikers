import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

import styles from './MaterialSymbol.module.css';

export type MaterialSymbolName =
  | 'add'
  | 'arrow_downward'
  | 'arrow_forward'
  | 'arrow_upward'
  | 'block'
  | 'check'
  | 'close'
  | 'content_copy'
  | 'expand_more'
  | 'logout'
  | 'more_horiz'
  | 'pause'
  | 'person_remove'
  | 'refresh'
  | 'remove'
  | 'shield_lock'
  | 'skip_next'
  | 'stop_circle'
  | 'style'
  | 'sync'
  | 'timer_off'
  | 'undo'
  | 'visibility_off'
  | 'wifi_off';

interface MaterialSymbolProps extends Omit<
  ComponentPropsWithoutRef<'span'>,
  'aria-hidden' | 'children'
> {
  name: MaterialSymbolName;
  filled?: boolean;
}

export function MaterialSymbol({
  name,
  filled = false,
  className,
  ...props
}: MaterialSymbolProps) {
  return (
    <span
      {...props}
      className={cn(styles.symbol, filled && styles.filled, className)}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
