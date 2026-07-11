'use client';

import { useRef, useState } from 'react';

import { getTeamTotal } from '@/features/game/domain/scoring';
import { useGameStore } from '@/features/game/store/GameStoreProvider';
import { useStageFocus } from '@/shared/hooks/useStageFocus/useStageFocus';

import { ActiveTurn } from '../ActiveTurn/ActiveTurn';
import { TurnHandoff } from '../TurnHandoff/TurnHandoff';
import { useGameSounds } from '../useGameSounds';
import { useLeaveGuard } from '../useLeaveGuard';
import { useTurnTimer } from '../useTurnTimer';

export function TurnScreen() {
  const round = useGameStore((state) => state.round);
  const scores = useGameStore((state) => state.scores);
  const initialCardCount = useGameStore((state) => state.chosenDeck.length);
  const remainingCards = useGameStore((state) => state.turn.remainingCards);
  const guessedCardCount = useGameStore(
    (state) => state.turn.guessedCards.length
  );
  const currentTeam = useGameStore((state) => state.turn.currentTeam);
  const timer = useGameStore((state) => state.turn.timer);
  const isActive = useGameStore((state) => state.turn.isActive);
  const canSkip = useGameStore((state) => state.turn.canSkip);
  const startTurn = useGameStore((state) => state.startTurn);
  const tickTimer = useGameStore((state) => state.tickTimer);
  const expireTurn = useGameStore((state) => state.expireTurn);
  const guessCard = useGameStore((state) => state.guessCard);
  const skipCard = useGameStore((state) => state.skipCard);
  const endTurn = useGameStore((state) => state.endTurn);
  const [isGuessDisabled, setIsGuessDisabled] = useState(false);
  const viewContainerRef = useRef<HTMLDivElement>(null);
  const { playBell, playRing, stopRing } = useGameSounds();

  const currentTeamNumber = currentTeam === 'team1' ? 1 : 2;
  const currentTeamScore = getTeamTotal(scores, currentTeam);

  useLeaveGuard();
  useStageFocus(viewContainerRef, `${currentTeam}:${isActive}`);
  useTurnTimer({
    isActive,
    timer,
    tickTimer,
    expireTurn,
    onExpire: playRing,
  });

  const handleStart = () => {
    stopRing();
    startTurn();
  };

  const handleGuess = () => {
    if (!isActive || remainingCards.length === 0 || isGuessDisabled) return;

    setIsGuessDisabled(true);
    playBell();
    if (remainingCards.length === 1) playRing();
    guessCard();

    window.setTimeout(() => setIsGuessDisabled(false), 1_000);
  };

  const handleEndTurn = () => {
    if (!isActive) return;
    playRing();
    endTurn();
  };

  if (!isActive) {
    return (
      <TurnHandoff
        round={round}
        currentTeamNumber={currentTeamNumber}
        remainingCardCount={remainingCards.length}
        initialCardCount={initialCardCount}
        currentTeamScore={currentTeamScore}
        onStart={handleStart}
        containerRef={viewContainerRef}
      />
    );
  }

  return (
    <ActiveTurn
      round={round}
      currentTeamNumber={currentTeamNumber}
      timer={timer}
      activeCard={remainingCards[0] ?? null}
      remainingCardCount={remainingCards.length}
      initialCardCount={initialCardCount}
      guessedCardCount={guessedCardCount}
      canSkip={canSkip}
      isGuessDisabled={isGuessDisabled}
      onSkip={skipCard}
      onGuess={handleGuess}
      onEndTurn={handleEndTurn}
      containerRef={viewContainerRef}
    />
  );
}
