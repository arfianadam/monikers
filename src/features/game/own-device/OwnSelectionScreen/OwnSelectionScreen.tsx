'use client';

import type { Ref } from 'react';

import { SelectionCard } from '@/features/game/card-selection/SelectionCard/SelectionCard';
import type { Card } from '@/features/game/domain/game-types';
import { cn } from '@/lib/utils';
import { Brand } from '@/shared/ui/Brand/Brand';
import {
  ConnectionStatus,
  type ConnectionStatusState,
} from '@/shared/ui/ConnectionStatus/ConnectionStatus';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { MaterialSymbol } from '@/shared/ui/MaterialSymbol/MaterialSymbol';
import { Panel } from '@/shared/ui/Panel/Panel';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

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
  connectionState?: ConnectionStatusState;
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
  /** Cards with toggle commands awaiting acknowledgement. */
  pendingCardWords: readonly string[];
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
            <MaterialSymbol
              name={status.state === 'done' ? 'check' : 'more_horiz'}
              filled={status.state === 'done'}
            />
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
          <TopBar
            trailing={
              <ConnectionStatus state={connectionState} onRetry={onRetry} />
            }
          >
            <Brand compact />
          </TopBar>

          <main className={styles.waitingMain}>
            <section className={styles.waitingCopy}>
              <MaterialSymbol
                name="check"
                className={styles.waitingMark}
                filled
              />
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
  const pendingCardWords = new Set(props.pendingCardWords);
  const remainingToSelect = Math.max(0, cardsPerPlayer - props.draft.length);
  const selectionComplete = props.draft.length === cardsPerPlayer;

  return (
    <GameShell variant="selection">
      <ScreenFrame
        ref={containerRef}
        className={styles.editingScreen}
        tabIndex={-1}
      >
        <TopBar
          className={styles.topBar}
          meta={
            <div className={styles.topStatus}>
              <span>
                <strong>{props.draft.length}</strong> / {cardsPerPlayer} dipilih
              </span>
            </div>
          }
          trailing={
            <ConnectionStatus state={connectionState} onRetry={onRetry} />
          }
        >
          <Brand compact />
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
                  <SelectionCard
                    key={card.word}
                    card={card}
                    selected={selected}
                    pending={pendingCardWords.has(card.word)}
                    onToggle={() => props.onToggleCard(card.word)}
                    disabled={mutationsDisabled || selectionLimitReached}
                  />
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
            <MaterialSymbol name="arrow_forward" />
          </GameButton>
        </div>
      </div>
    </GameShell>
  );
}
