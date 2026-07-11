'use client';

import { useEffect, useRef } from 'react';

import { GameButton } from '@/shared/ui/GameButton/GameButton';

import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onCancelRef.current();
    };

    dialog.addEventListener('cancel', handleCancel);
    if (!dialog.open) dialog.showModal();
    cancelButtonRef.current?.focus();

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      if (dialog.open) dialog.close();
      previousFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <h2 id="confirm-dialog-title">{title}</h2>
      <p id="confirm-dialog-description">{description}</p>
      <div className={styles.actions}>
        <GameButton
          ref={cancelButtonRef}
          variant="secondary"
          type="button"
          onClick={onCancel}
        >
          Batal
        </GameButton>
        <GameButton type="button" onClick={onConfirm}>
          {confirmLabel}
        </GameButton>
      </div>
    </dialog>
  );
}
