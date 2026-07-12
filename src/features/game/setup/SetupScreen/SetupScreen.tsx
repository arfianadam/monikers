'use client';

import { useGameStore } from '@/features/game/store/GameStoreProvider';

import { SetupView } from './SetupView';

export interface SetupScreenProps {
  onEndSession?: () => void;
}

export function SetupScreen({ onEndSession }: SetupScreenProps) {
  const players = useGameStore((state) => state.setup.players);
  const cardsPerPlayer = useGameStore((state) => state.setup.cardsPerPlayer);
  const setPlayers = useGameStore((state) => state.setPlayers);
  const setCardsPerPlayer = useGameStore((state) => state.setCardsPerPlayer);
  const startGame = useGameStore((state) => state.startGame);

  return (
    <SetupView
      players={players}
      cardsPerPlayer={cardsPerPlayer}
      onPlayersChange={setPlayers}
      onCardsPerPlayerChange={setCardsPerPlayer}
      onStart={startGame}
      onEndSession={onEndSession}
    />
  );
}
