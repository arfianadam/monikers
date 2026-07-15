'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { MaterialSymbol } from '@/shared/ui/MaterialSymbol/MaterialSymbol';

import styles from './SessionActionsMenu.module.css';

export interface SessionActionsMenuProps {
  disabled?: boolean;
  canReturnToLobby: boolean;
  canEndSession: boolean;
  onLeave: () => void;
  onReturnToLobby: () => void;
  onEndSession: () => void;
}

export function SessionActionsMenu({
  disabled = false,
  canReturnToLobby,
  canEndSession,
  onLeave,
  onReturnToLobby,
  onEndSession,
}: SessionActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };

    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const selectAction = (action: () => void) => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
    action();
  };

  return (
    <div ref={containerRef} className={styles.container} aria-label="Menu sesi">
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? 'Tutup menu sesi' : 'Buka menu sesi'}
        title="Menu sesi"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <MaterialSymbol name="more_horiz" />
        <span className={styles.triggerLabel}>Menu</span>
      </button>

      {open && (
        <section
          id={menuId}
          className={styles.panel}
          aria-label="Pilihan menu sesi"
        >
          <p>Menu sesi</p>
          {canReturnToLobby && (
            <button
              type="button"
              className={styles.action}
              onClick={() => selectAction(onReturnToLobby)}
            >
              <MaterialSymbol name="undo" />
              <span>
                <strong>Balik ke lobby</strong>
                <small>Kode dan player tetap aman</small>
              </span>
            </button>
          )}
          <button
            type="button"
            className={styles.action}
            onClick={() => selectAction(onLeave)}
          >
            <MaterialSymbol name="logout" />
            <span>
              <strong>Keluar dari sesi</strong>
              <small>Cuma device ini yang keluar</small>
            </span>
          </button>
          {canEndSession && (
            <button
              type="button"
              className={cn(styles.action, styles.dangerAction)}
              onClick={() => selectAction(onEndSession)}
            >
              <MaterialSymbol name="stop_circle" filled />
              <span>
                <strong>Tutup sesi</strong>
                <small>Hentikan game buat semua</small>
              </span>
            </button>
          )}
        </section>
      )}
    </div>
  );
}
