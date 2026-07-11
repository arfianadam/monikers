'use client';

import { useGameStore } from '@/features/game/store/GameStoreProvider';

import { ScoreView } from './ScoreView';

export function ScoreScreen() {
  const scores = useGameStore((state) => state.scores);
  const isGameOver = useGameStore((state) => state.stage === 'final-score');
  const playAgain = useGameStore((state) => state.playAgain);
  const startNextRound = useGameStore((state) => state.startNextRound);

  return (
    <ScoreView
      scores={scores}
      isGameOver={isGameOver}
      onContinue={isGameOver ? playAgain : startNextRound}
    />
  );
}
