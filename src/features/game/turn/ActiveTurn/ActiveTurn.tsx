import type { CSSProperties, Ref } from 'react';

import type { Card, RoundNumber } from '@/features/game/domain/game-types';
import { ROUND_DURATION_SECONDS } from '@/features/game/domain/rounds';
import { cn } from '@/lib/utils';
import { Brand } from '@/shared/ui/Brand/Brand';
import { GameButton } from '@/shared/ui/GameButton/GameButton';
import { GameShell } from '@/shared/ui/GameShell/GameShell';
import { Panel } from '@/shared/ui/Panel/Panel';
import { RoundPips } from '@/shared/ui/RoundPips/RoundPips';
import { ScreenFrame } from '@/shared/ui/ScreenFrame/ScreenFrame';
import { TopBar } from '@/shared/ui/TopBar/TopBar';

import styles from './ActiveTurn.module.css';

export interface ActiveTurnProps {
  round: RoundNumber;
  currentTeamNumber: 1 | 2;
  timer: number;
  remainingCards: readonly Card[];
  initialCardCount: number;
  guessedCardCount: number;
  canSkip: boolean;
  isGuessDisabled: boolean;
  onSkip: () => void;
  onGuess: () => void;
  onEndTurn: () => void;
  containerRef?: Ref<HTMLDivElement>;
}

export function ActiveTurn({
  round,
  currentTeamNumber,
  timer,
  remainingCards,
  initialCardCount,
  guessedCardCount,
  canSkip,
  isGuessDisabled,
  onSkip,
  onGuess,
  onEndTurn,
  containerRef,
}: ActiveTurnProps) {
  const activeCard = remainingCards[0];
  const timerStyle = {
    '--timer-progress': `${(timer / ROUND_DURATION_SECONDS) * 360}deg`,
  } as CSSProperties;

  return (
    <GameShell variant="play" team={currentTeamNumber}>
      <ScreenFrame ref={containerRef} className={styles.screen} tabIndex={-1}>
        <TopBar className={styles.topBar}>
          <Brand compact />
          <RoundPips round={round} />
        </TopBar>

        <div className={styles.hud}>
          <div className={styles.teamChip}>
            <span className={styles.teamDot} />
            Tim {currentTeamNumber}
          </div>
          <div className={styles.timerBlock}>
            <div
              className={cn(
                styles.timerDial,
                timer <= 10 && styles.urgentTimer
              )}
              style={timerStyle}
              aria-label={`${timer} detik tersisa`}
            >
              <span>{timer}</span>
            </div>
            <span className={styles.timerLabel}>detik</span>
          </div>
          <div className={styles.deckChip}>
            <strong>{remainingCards.length}</strong>
            <span>kartu tersisa</span>
          </div>
        </div>

        <main className={styles.stage}>
          {activeCard && (
            <Panel
              as="article"
              key={activeCard.word}
              className={styles.activeCard}
              data-level={activeCard.level}
              aria-live="polite"
            >
              <div className={styles.cardTopline}>
                <span className={styles.levelBadge}>
                  Tingkat {activeCard.level}
                </span>
                <span className={styles.cardSerial}>
                  {String(remainingCards.length).padStart(2, '0')} /{' '}
                  {String(initialCardCount).padStart(2, '0')}
                </span>
              </div>
              <div className={styles.cardCopy}>
                <p>Buat timmu menebak</p>
                <h1>{activeCard.word}</h1>
                <span>{activeCard.description}</span>
              </div>
              <div className={styles.cardFooter}>
                <span>Monikers</span>
                <span>Babak 0{round}</span>
              </div>
            </Panel>
          )}
        </main>

        <div className={styles.actions}>
          <div className={styles.actionRow}>
            <GameButton
              variant="secondary"
              onClick={onSkip}
              disabled={!canSkip || remainingCards.length <= 1}
              className={cn(styles.actionButton, styles.skipButton)}
            >
              <span aria-hidden="true">↻</span>
              {canSkip ? 'Lewati' : 'Sudah digunakan'}
            </GameButton>
            <GameButton
              variant="success"
              onClick={onGuess}
              disabled={isGuessDisabled}
              className={cn(styles.actionButton, styles.guessButton)}
            >
              Benar!
              <span aria-hidden="true">✓</span>
            </GameButton>
          </div>
          <div className={styles.actionMeta}>
            <span>
              {guessedCardCount} kartu berhasil ditebak pada giliran ini
              {!canSkip && ' · Tebak dengan benar agar bisa melewati lagi'}
            </span>
            <button onClick={onEndTurn} className={styles.endTurnButton}>
              Akhiri giliran lebih awal
            </button>
          </div>
        </div>
      </ScreenFrame>
    </GameShell>
  );
}
