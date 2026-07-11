import { cn } from '@/lib/utils';
import { GameButton } from '@/shared/ui/GameButton/GameButton';

import type { SessionConnectionStatus } from '../useSessionSocket/useSessionSocket';
import styles from './ConnectionStatus.module.css';

export interface ConnectionStatusProps {
  status: SessionConnectionStatus;
  onRetry: () => void;
}

export function ConnectionStatus({ status, onRetry }: ConnectionStatusProps) {
  const label =
    status === 'connected'
      ? 'Terhubung'
      : status === 'connecting'
        ? 'Menghubungkan…'
        : 'Koneksi terputus';

  return (
    <div
      className={cn(styles.status, styles[status])}
      data-state={status}
      role="status"
      aria-live="polite"
    >
      <span className={styles.dot} aria-hidden="true" />
      <span>{label}</span>
      {status === 'disconnected' && (
        <GameButton
          type="button"
          variant="secondary"
          className={styles.retry}
          onClick={onRetry}
        >
          Coba lagi
        </GameButton>
      )}
    </div>
  );
}
