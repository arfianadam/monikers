import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

import styles from './ConnectionStatus.module.css';

export type OwnDeviceConnectionState =
  'connected' | 'connecting' | 'disconnected';

export interface ConnectionStatusProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  state: OwnDeviceConnectionState;
  onRetry?: () => void;
}

const connectionLabels: Record<OwnDeviceConnectionState, string> = {
  connected: 'Tersambung',
  connecting: 'Menyambungkan…',
  disconnected: 'Koneksi terputus',
};

export function ConnectionStatus({
  className,
  state,
  onRetry,
  ...props
}: ConnectionStatusProps) {
  return (
    <div
      {...props}
      className={cn(styles.status, styles[state], className)}
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
