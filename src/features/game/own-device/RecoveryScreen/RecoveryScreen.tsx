'use client';

import type { Ref } from 'react';

import { Brand } from '@/shared/ui/Brand/Brand';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { Panel } from '@/shared/ui/Panel/Panel';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import { ConnectionStatus } from '../ConnectionStatus/ConnectionStatus';
import styles from './RecoveryScreen.module.css';

export type TransientRecoveryReason = 'connecting' | 'disconnected';
export type TerminalRecoveryReason =
  'duplicate-tab' | 'revoked' | 'expired' | 'ended';

interface RecoveryBaseProps {
  onGoHome: () => void;
  detailMessage?: string;
  containerRef?: Ref<HTMLDivElement>;
}

export interface TransientRecoveryScreenProps extends RecoveryBaseProps {
  reason: TransientRecoveryReason;
  onRetry: () => void;
  retryDisabled?: boolean;
}

export interface TerminalRecoveryScreenProps extends RecoveryBaseProps {
  reason: TerminalRecoveryReason;
}

export type RecoveryScreenProps =
  TransientRecoveryScreenProps | TerminalRecoveryScreenProps;

const recoveryCopy: Record<
  TransientRecoveryReason | TerminalRecoveryReason,
  { eyebrow: string; title: string; body: string }
> = {
  connecting: {
    eyebrow: 'Menyambungkan kembali',
    title: 'Sebentar, ya.',
    body: 'Kami sedang mencari kembali sesi dan keanggotaanmu. Perubahan permainan dinonaktifkan sampai koneksi pulih.',
  },
  disconnected: {
    eyebrow: 'Koneksi terputus',
    title: 'Kamu sedang luring.',
    body: 'Perangkat ini belum tersambung ke sesi. Permainan tetap berjalan di server dan akan dipulihkan saat koneksi kembali.',
  },
  'duplicate-tab': {
    eyebrow: 'Sesi dibuka di tab lain',
    title: 'Tab ini sudah digantikan.',
    body: 'Keanggotaan yang sama baru saja tersambung dari tab lain. Lanjutkan permainan dari tab yang paling baru.',
  },
  revoked: {
    eyebrow: 'Akses dicabut',
    title: 'Kamu bukan anggota sesi ini lagi.',
    body: 'Keanggotaan perangkat ini telah dicabut dan tidak dapat digunakan untuk masuk kembali ke ruangan yang sama.',
  },
  expired: {
    eyebrow: 'Sesi kedaluwarsa',
    title: 'Ruangan ini sudah hilang.',
    body: 'Sesi tidak lagi tersedia. Kamu dapat kembali ke halaman awal untuk membuat sesi baru atau bergabung dengan kode lain.',
  },
  ended: {
    eyebrow: 'Sesi diakhiri',
    title: 'Permainan telah selesai.',
    body: 'Pengendali mengakhiri sesi untuk semua pemain. Kode ruangan ini tidak dapat digunakan lagi.',
  },
};

export function RecoveryScreen(props: RecoveryScreenProps) {
  const copy = recoveryCopy[props.reason];
  const isTransient =
    props.reason === 'connecting' || props.reason === 'disconnected';

  return (
    <GameShell variant="handoff">
      <ScreenFrame
        ref={props.containerRef}
        className={styles.screen}
        tabIndex={-1}
      >
        <TopBar>
          <Brand compact />
          {isTransient && (
            <ConnectionStatus
              state={
                props.reason === 'connecting' ? 'connecting' : 'disconnected'
              }
            />
          )}
        </TopBar>

        <main className={styles.main}>
          <Panel
            as="section"
            className={styles.card}
            aria-live={isTransient ? 'polite' : undefined}
          >
            <span className={styles.statusMark} aria-hidden="true">
              {props.reason === 'connecting'
                ? '…'
                : props.reason === 'disconnected'
                  ? '↻'
                  : props.reason === 'duplicate-tab'
                    ? '▣'
                    : '×'}
            </span>
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            <h1>{copy.title}</h1>
            <p>{props.detailMessage ?? copy.body}</p>

            <div className={styles.actions}>
              {isTransient && (
                <GameButton
                  type="button"
                  onClick={props.onRetry}
                  disabled={props.retryDisabled}
                >
                  {props.reason === 'connecting'
                    ? 'Sambungkan sekarang'
                    : 'Coba lagi'}
                  <span aria-hidden="true">↻</span>
                </GameButton>
              )}
              <button type="button" onClick={props.onGoHome}>
                Kembali ke halaman awal
              </button>
            </div>
          </Panel>
        </main>
      </ScreenFrame>
    </GameShell>
  );
}
