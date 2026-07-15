'use client';

import type { Ref } from 'react';

import { Brand } from '@/shared/ui/Brand/Brand';
import { ConnectionStatus } from '@/shared/ui/ConnectionStatus/ConnectionStatus';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import {
  MaterialSymbol,
  type MaterialSymbolName,
} from '@/shared/ui/MaterialSymbol/MaterialSymbol';
import { Panel } from '@/shared/ui/Panel/Panel';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

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
    eyebrow: 'Lagi reconnect',
    title: 'Bentar, ya.',
    body: 'Lagi cari sesi dan data player-mu. Kontrol game dimatikan dulu sampai koneksi balik.',
  },
  disconnected: {
    eyebrow: 'Koneksi putus',
    title: 'Kamu lagi offline.',
    body: 'Device ini belum tersambung ke sesi. Game tetap jalan dan bakal balik otomatis saat koneksi pulih.',
  },
  'duplicate-tab': {
    eyebrow: 'Sesi kebuka di tab lain',
    title: 'Pakai tab yang baru, ya.',
    body: 'Player yang sama baru saja tersambung dari tab lain. Lanjut main dari tab paling baru.',
  },
  revoked: {
    eyebrow: 'Akses dilepas',
    title: 'Kamu sudah keluar dari sesi.',
    body: 'Device ini sudah dikeluarkan dan nggak bisa join lagi ke room yang sama.',
  },
  expired: {
    eyebrow: 'Sesi expired',
    title: 'Room ini sudah nggak ada.',
    body: 'Sesi ini sudah selesai. Balik ke home buat bikin sesi baru atau join pakai kode lain.',
  },
  ended: {
    eyebrow: 'Sesi ditutup',
    title: 'Game sudah selesai.',
    body: 'Host menutup sesi buat semua player. Room code ini sudah nggak bisa dipakai.',
  },
};

const recoveryIcons = {
  connecting: 'sync',
  disconnected: 'wifi_off',
  'duplicate-tab': 'content_copy',
  revoked: 'block',
  expired: 'timer_off',
  ended: 'stop_circle',
} satisfies Record<
  TransientRecoveryReason | TerminalRecoveryReason,
  MaterialSymbolName
>;

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
        <TopBar
          trailing={
            isTransient ? (
              <ConnectionStatus
                state={
                  props.reason === 'connecting' ? 'connecting' : 'disconnected'
                }
              />
            ) : undefined
          }
        >
          <Brand compact />
        </TopBar>

        <main className={styles.main}>
          <Panel
            as="section"
            className={styles.card}
            aria-live={isTransient ? 'polite' : undefined}
          >
            <MaterialSymbol
              name={recoveryIcons[props.reason]}
              className={styles.statusMark}
              filled
            />
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
                    ? 'Reconnect sekarang'
                    : 'Coba lagi'}
                  <MaterialSymbol name="refresh" />
                </GameButton>
              )}
              <button type="button" onClick={props.onGoHome}>
                Balik ke home
              </button>
            </div>
          </Panel>
        </main>
      </ScreenFrame>
    </GameShell>
  );
}
