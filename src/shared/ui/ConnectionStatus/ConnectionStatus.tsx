import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

import styles from './ConnectionStatus.module.css';

export type ConnectionStatusState = 'connected' | 'connecting' | 'disconnected';

export interface ConnectionStatusProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  state: ConnectionStatusState;
  onRetry?: () => void;
}

const connectionLabels: Record<ConnectionStatusState, string> = {
  connected: 'Online',
  connecting: 'Connecting…',
  disconnected: 'Offline',
};

export function ConnectionStatus({
  'aria-label': ariaLabel,
  className,
  state,
  onRetry,
  ...props
}: ConnectionStatusProps) {
  return (
    <div
      {...props}
      aria-label={ariaLabel ?? 'Status koneksi'}
      className={cn(styles.status, styles[state], className)}
      data-state={state}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={styles.dot} aria-hidden="true" />
      <span>{connectionLabels[state]}</span>
      {state === 'disconnected' && onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Coba lagi
        </button>
      )}
    </div>
  );
}
