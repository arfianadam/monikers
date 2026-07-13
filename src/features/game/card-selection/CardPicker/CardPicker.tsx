import type { ReactNode, Ref } from 'react';

import type { Card } from '@/features/game/domain/game-types';
import { Brand } from '@/shared/ui/Brand/Brand';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { MaterialSymbol } from '@/shared/ui/MaterialSymbol/MaterialSymbol';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import { SelectionCard } from '../SelectionCard/SelectionCard';
import styles from './CardPicker.module.css';

export interface CardPickerProps {
  currentPlayer: number;
  players: number;
  cardsPerPlayer: number;
  availableCards: readonly Card[];
  selectedCards: readonly Card[];
  pendingCardWords?: readonly string[];
  disabled?: boolean;
  connectionStatus?: ReactNode;
  onToggleCard: (card: Card) => void;
  onNextPlayer: () => void;
  containerRef?: Ref<HTMLDivElement>;
}

export function CardPicker({
  currentPlayer,
  players,
  cardsPerPlayer,
  availableCards,
  selectedCards,
  pendingCardWords = [],
  disabled = false,
  connectionStatus,
  onToggleCard,
  onNextPlayer,
  containerRef,
}: CardPickerProps) {
  const selectionProgress = Math.round(
    (selectedCards.length / cardsPerPlayer) * 100
  );
  const cardsLeftToPick = Math.max(0, cardsPerPlayer - selectedCards.length);
  const selectedWords = new Set(selectedCards.map((card) => card.word));
  const pendingWords = new Set(pendingCardWords);
  const selectionLimitReached = selectedCards.length >= cardsPerPlayer;
  return (
    <GameShell variant="selection">
      <ScreenFrame ref={containerRef} className={styles.screen} tabIndex={-1}>
        <TopBar
          className={styles.topBar}
          meta={
            <div className={styles.status}>
              <span className={styles.statusPlayer}>
                Pemain {currentPlayer} dari {players}
              </span>
              <span className={styles.statusCount}>
                <strong>{selectedCards.length}</strong> / {cardsPerPlayer}{' '}
                dipilih
              </span>
            </div>
          }
          trailing={connectionStatus}
        >
          <Brand compact />
        </TopBar>

        <main className={styles.main}>
          <div className={styles.heading}>
            <div>
              <Eyebrow onDark>Susun deck bersama</Eyebrow>
              <h1>Pilih favoritmu</h1>
            </div>
            <p>
              Pilih nama yang kamu kenal—atau yang paling lucu untuk dijelaskan
              nanti.
            </p>
          </div>

          <div className={styles.meter} aria-hidden="true">
            <span style={{ width: `${selectionProgress}%` }} />
          </div>

          <div className={styles.grid}>
            {availableCards.map((card) => {
              const isSelected = selectedWords.has(card.word);

              return (
                <SelectionCard
                  key={card.word}
                  card={card}
                  selected={isSelected}
                  pending={pendingWords.has(card.word)}
                  disabled={disabled || (selectionLimitReached && !isSelected)}
                  onToggle={() => onToggleCard(card)}
                />
              );
            })}
          </div>
        </main>
      </ScreenFrame>

      <div className={styles.dock}>
        <div className={styles.dockInner}>
          <div className={styles.dockCount} aria-live="polite">
            <span aria-label={`${selectedCards.length} kartu dipilih`}>
              {selectedCards.length}
            </span>
            <p>
              <strong>
                {cardsLeftToPick === 0
                  ? 'Semua sudah dipilih'
                  : `${cardsLeftToPick} kartu lagi`}
              </strong>
              <span>
                {selectedCards.length} dari {cardsPerPlayer} dipilih
              </span>
            </p>
          </div>
          <GameButton
            type="button"
            className={styles.nextButton}
            onClick={onNextPlayer}
            disabled={disabled || selectedCards.length !== cardsPerPlayer}
          >
            {currentPlayer < players
              ? 'Serahkan ke pemain berikutnya'
              : 'Selesai'}
            <MaterialSymbol name="arrow_forward" />
          </GameButton>
        </div>
      </div>
    </GameShell>
  );
}
