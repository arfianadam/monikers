import type { Ref } from 'react';

import type { Card } from '@/features/game/domain/game-types';
import { cn } from '@/lib/utils';
import { Brand } from '@/shared/ui/Brand/Brand';
import { Eyebrow } from '@/shared/ui/Eyebrow/Eyebrow';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import styles from './CardPicker.module.css';

export interface CardPickerProps {
  currentPlayer: number;
  players: number;
  cardsPerPlayer: number;
  availableCards: readonly Card[];
  selectedCards: readonly Card[];
  disabled?: boolean;
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
  disabled = false,
  onToggleCard,
  onNextPlayer,
  containerRef,
}: CardPickerProps) {
  const selectionProgress = Math.round(
    (selectedCards.length / cardsPerPlayer) * 100
  );
  const cardsLeftToPick = Math.max(0, cardsPerPlayer - selectedCards.length);
  return (
    <GameShell variant="selection">
      <ScreenFrame ref={containerRef} className={styles.screen} tabIndex={-1}>
        <TopBar className={styles.topBar}>
          <Brand compact />
          <div className={styles.status}>
            <span className={styles.statusPlayer}>
              Pemain {currentPlayer} dari {players}
            </span>
            <span className={styles.statusCount}>
              <strong>{selectedCards.length}</strong> / {cardsPerPlayer} dipilih
            </span>
          </div>
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
              const isSelected = selectedCards.some(
                (selected) => selected.word === card.word
              );

              return (
                <button
                  type="button"
                  key={card.word}
                  className={cn(
                    styles.selectionCard,
                    isSelected && styles.selectedCard
                  )}
                  data-level={card.level}
                  aria-pressed={isSelected}
                  disabled={disabled}
                  onClick={() => onToggleCard(card)}
                >
                  <span className={styles.cardTopline}>
                    <span className={styles.levelBadge}>
                      Tingkat {card.level}
                    </span>
                    <span className={styles.cardCheck} aria-hidden="true">
                      ✓
                    </span>
                  </span>
                  <strong>{card.word}</strong>
                  <span className={styles.cardDescription}>
                    {card.description}
                  </span>
                  <span className={styles.cardAction} aria-hidden="true">
                    {isSelected ? 'Sudah dipilih' : 'Ketuk untuk memilih'}
                    <span>{isSelected ? '✓' : '+'}</span>
                  </span>
                </button>
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
            <span aria-hidden="true">→</span>
          </GameButton>
        </div>
      </div>
    </GameShell>
  );
}
