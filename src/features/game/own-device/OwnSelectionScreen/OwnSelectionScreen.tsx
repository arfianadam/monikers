'use client';

import type { Ref } from 'react';

import type { Card } from '@/features/game/domain/game-types';
import { cn } from '@/lib/utils';
import { Brand } from '@/shared/ui/Brand/Brand';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { Panel } from '@/shared/ui/Panel/Panel';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import {
  ConnectionStatus,
  type OwnDeviceConnectionState,
} from '../ConnectionStatus/ConnectionStatus';
import styles from './OwnSelectionScreen.module.css';

export type OwnSelectionPlayerState = 'selecting' | 'done';

export interface OwnSelectionPlayerStatusView {
  id: string;
  displayName: string;
  state: OwnSelectionPlayerState;
  isCurrentPlayer?: boolean;
}

export interface OwnSelectionCancellationView {
  blockedPlayerNames?: readonly string[];
  onCancel: () => void;
  disabled?: boolean;
}

interface OwnSelectionBaseProps {
  playerName: string;
  cardsPerPlayer: number;
  statuses: readonly OwnSelectionPlayerStatusView[];
  connectionState?: OwnDeviceConnectionState;
  onRetry?: () => void;
  actionsDisabled?: boolean;
  cancellation?: OwnSelectionCancellationView;
  containerRef?: Ref<HTMLDivElement>;
}

export interface OwnSelectionEditingProps extends OwnSelectionBaseProps {
  view: 'editing';
  /** The current recipient's private offer. Never pass another player's cards. */
  offer: readonly Card[];
  /** The current recipient's private, server-confirmed draft. */
  draft: readonly Card[];
  onToggleCard: (cardWord: string) => void;
  onConfirm: () => void;
}

export interface OwnSelectionWaitingProps extends OwnSelectionBaseProps {
  view: 'waiting';
}

export type OwnSelectionScreenProps =
  OwnSelectionEditingProps | OwnSelectionWaitingProps;

function SelectionStatuses({
  statuses,
}: {
  statuses: readonly OwnSelectionPlayerStatusView[];
}) {
  const completeCount = statuses.filter(
    (status) => status.state === 'done'
  ).length;

  return (
    <Panel
      as="section"
      className={styles.statusPanel}
      aria-labelledby="selection-status-heading"
    >
      <div className={styles.statusHeading}>
        <div>
          <span>Progres bersama</span>
          <h2 id="selection-status-heading">Siapa yang sudah selesai?</h2>
        </div>
        <strong aria-label={`${completeCount} dari ${statuses.length} selesai`}>
          {completeCount}/{statuses.length}
        </strong>
      </div>
      <ul className={styles.statusList}>
        {statuses.map((status) => (
          <li
            key={status.id}
            className={cn(
              status.state === 'done' && styles.statusDone,
              status.isCurrentPlayer && styles.currentStatus
            )}
          >
            <span aria-hidden="true">
              {status.state === 'done' ? '✓' : '…'}
            </span>
            <span>
              <strong>{status.displayName}</strong>
              {status.isCurrentPlayer && <small>kamu</small>}
            </span>
            <em>{status.state === 'done' ? 'Selesai' : 'Memilih…'}</em>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function CancellationNotice({
  cancellation,
  disabled,
}: {
  cancellation: OwnSelectionCancellationView;
  disabled: boolean;
}) {
  const names = cancellation.blockedPlayerNames ?? [];

  return (
    <section className={styles.cancellation} aria-labelledby="cancel-heading">
      <div>
        <strong id="cancel-heading">Pemilihan sedang tertahan.</strong>
        <p>
          {names.length > 0
            ? `${names.join(', ')} telah meninggalkan sesi. Kamu dapat terus menunggu atau kembali ke ruang tunggu.`
            : 'Seorang pemain telah meninggalkan sesi. Kamu dapat terus menunggu atau kembali ke ruang tunggu.'}
        </p>
      </div>
      <button
        type="button"
        onClick={cancellation.onCancel}
        disabled={disabled || cancellation.disabled}
      >
        Batalkan dan kembali ke ruang tunggu
      </button>
    </section>
  );
}

export function OwnSelectionScreen(props: OwnSelectionScreenProps) {
  const {
    playerName,
    cardsPerPlayer,
    statuses,
    connectionState = 'connected',
    onRetry,
    actionsDisabled = false,
    cancellation,
    containerRef,
  } = props;
  const mutationsDisabled = actionsDisabled || connectionState !== 'connected';

  if (props.view === 'waiting') {
    const completeCount = statuses.filter(
      (status) => status.state === 'done'
    ).length;

    return (
      <GameShell variant="selection">
        <ScreenFrame
          ref={containerRef}
          className={styles.waitingScreen}
          tabIndex={-1}
        >
          <TopBar>
            <Brand compact />
            <ConnectionStatus state={connectionState} onRetry={onRetry} />
          </TopBar>

          <main className={styles.waitingMain}>
            <section className={styles.waitingCopy}>
              <span className={styles.waitingMark} aria-hidden="true">
                ✓
              </span>
              <Eyebrow onDark>Pilihanmu sudah dikunci</Eyebrow>
              <h1>Tunggu yang lain.</h1>
              <p>
                Kartu pilihan {playerName} aman dan tidak bisa diubah lagi.
                Permainan dimulai otomatis setelah semua pemain selesai.
              </p>
              <div className={styles.progress}>
                <span>
                  <strong>{completeCount}</strong> dari {statuses.length}
                </span>
                <p>pemain sudah selesai memilih</p>
              </div>
            </section>

            <SelectionStatuses statuses={statuses} />

            {cancellation && (
              <CancellationNotice
                cancellation={cancellation}
                disabled={mutationsDisabled}
              />
            )}
          </main>
        </ScreenFrame>
      </GameShell>
    );
  }

  const selectedWords = new Set(props.draft.map((card) => card.word));
  const remainingToSelect = Math.max(0, cardsPerPlayer - props.draft.length);
  const selectionComplete = props.draft.length === cardsPerPlayer;

  return (
    <GameShell variant="selection">
      <ScreenFrame
        ref={containerRef}
        className={styles.editingScreen}
        tabIndex={-1}
      >
        <TopBar className={styles.topBar}>
          <Brand compact />
          <div className={styles.topStatus}>
            <span>
              <strong>{props.draft.length}</strong> / {cardsPerPlayer} dipilih
            </span>
            <ConnectionStatus state={connectionState} onRetry={onRetry} />
          </div>
        </TopBar>

        <main className={styles.editingMain}>
          <section className={styles.selectionArea}>
            <div className={styles.selectionHeading}>
              <div>
                <Eyebrow onDark>Pilihan pribadi · {playerName}</Eyebrow>
                <h1>Pilih favoritmu.</h1>
              </div>
              <p>
                Hanya kamu yang dapat melihat tawaran ini. Pilih tepat{' '}
                {cardsPerPlayer} kartu, lalu kunci pilihanmu.
              </p>
            </div>

            <div className={styles.meter} aria-hidden="true">
              <span
                style={{
                  width: `${Math.min(100, (props.draft.length / cardsPerPlayer) * 100)}%`,
                }}
              />
            </div>

            <div className={styles.cardGrid}>
              {props.offer.map((card) => {
                const selected = selectedWords.has(card.word);
                const selectionLimitReached =
                  props.draft.length >= cardsPerPlayer && !selected;

                return (
                  <button
                    type="button"
                    key={card.word}
                    className={cn(
                      styles.selectionCard,
                      selected && styles.selectedCard
                    )}
                    data-level={card.level}
                    aria-pressed={selected}
                    onClick={() => props.onToggleCard(card.word)}
                    disabled={mutationsDisabled || selectionLimitReached}
                  >
                    <span className={styles.cardTopline}>
                      <span>Tingkat {card.level}</span>
                      <span className={styles.cardCheck} aria-hidden="true">
                        {selected ? '✓' : '+'}
                      </span>
                    </span>
                    <strong>{card.word}</strong>
                    <span className={styles.cardDescription}>
                      {card.description}
                    </span>
                    <span className={styles.cardAction} aria-hidden="true">
                      {selected ? 'Dipilih' : 'Pilih kartu'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <SelectionStatuses statuses={statuses} />

          {cancellation && (
            <CancellationNotice
              cancellation={cancellation}
              disabled={mutationsDisabled}
            />
          )}
        </main>
      </ScreenFrame>

      <div className={styles.dock}>
        <div className={styles.dockInner}>
          <div
            className={styles.dockCopy}
            aria-live="polite"
            aria-atomic="true"
          >
            <span>{props.draft.length}</span>
            <p>
              <strong>
                {selectionComplete
                  ? 'Pilihan sudah lengkap'
                  : `Pilih ${remainingToSelect} kartu lagi`}
              </strong>
              <small>Konfirmasi tidak dapat dibatalkan.</small>
            </p>
          </div>
          <GameButton
            type="button"
            onClick={props.onConfirm}
            disabled={!selectionComplete || mutationsDisabled}
          >
            Kunci pilihan
            <span aria-hidden="true">→</span>
          </GameButton>
        </div>
      </div>
    </GameShell>
  );
}
