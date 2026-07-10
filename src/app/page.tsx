'use client';

import { useEffect, useRef, useState } from 'react';
import SetupScreen from '@/components/SetupScreen';
import CardSelectionScreen from '@/components/CardSelectionScreen';
import GameScreen, { Card, ScoresByRound } from '@/components/GameScreen';
import ScoreScreen from '@/components/ScoreScreen';

export default function Home() {
  const [stage, setStage] = useState<
    'setup' | 'card-selection' | 'game' | 'round-score' | 'score'
  >('setup');
  const [players, setPlayers] = useState(0);
  const [cardsPerPlayer, setCardsPerPlayer] = useState(0);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [scores, setScores] = useState<ScoresByRound>({
    team1: {},
    team2: {},
  });
  const [round, setRound] = useState(1);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const isInitialStage = useRef(true);

  useEffect(() => {
    window.scrollTo(0, 0);

    if (isInitialStage.current) {
      isInitialStage.current = false;
      return;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      const heading = stageContainerRef.current?.querySelector('h1');
      if (heading instanceof HTMLElement) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [stage]);

  const handleGameStart = (playerCount: number, cardCount: number) => {
    setPlayers(playerCount);
    setCardsPerPlayer(cardCount);
    setStage('card-selection');
  };

  const handleCardSelectionEnd = (selectedCards: Card[]) => {
    setAllCards(selectedCards);
    setStage('game');
  };

  const handleRoundEnd = (roundScores: ScoresByRound) => {
    setScores(roundScores);
    setStage('round-score');
  };

  const handleNextRound = () => {
    setRound((prev) => prev + 1);
    setStage('game');
  };

  const handleGameEnd = (finalScores: ScoresByRound) => {
    setScores(finalScores);
    setStage('score');
  };

  const handlePlayAgain = () => {
    setStage('setup');
    setPlayers(0);
    setCardsPerPlayer(0);
    setAllCards([]);
    setScores({
      team1: {},
      team2: {},
    });
    setRound(1);
  };

  return (
    <div ref={stageContainerRef}>
      {stage === 'setup' && <SetupScreen onStartGame={handleGameStart} />}
      {stage === 'card-selection' && (
        <CardSelectionScreen
          players={players}
          cardsPerPlayer={cardsPerPlayer}
          onSelectionEnd={handleCardSelectionEnd}
        />
      )}
      {stage === 'game' && (
        <GameScreen
          initialCards={allCards}
          onGameEnd={handleGameEnd}
          onRoundEnd={handleRoundEnd}
          round={round}
          scores={scores}
        />
      )}
      {(stage === 'score' || stage === 'round-score') && (
        <ScoreScreen
          scores={scores}
          onPlayAgain={handlePlayAgain}
          onNextRound={handleNextRound}
          isGameOver={stage === 'score'}
        />
      )}
    </div>
  );
}
