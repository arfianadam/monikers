'use client';

import { useRef } from 'react';

import { useGameStore } from '@/features/game/store/GameStoreProvider';
import { useStageScroll } from '@/shared/hooks/useStageScroll/useStageScroll';

import { CardPicker } from '../CardPicker/CardPicker';
import { PrivateHandoff } from '../PrivateHandoff/PrivateHandoff';

export function CardSelectionScreen() {
  const players = useGameStore((state) => state.setup.players);
  const cardsPerPlayer = useGameStore((state) => state.setup.cardsPerPlayer);
  const currentPlayer = useGameStore((state) => state.selection.currentPlayer);
  const availableCards = useGameStore(
    (state) => state.selection.availableCards
  );
  const selectedCards = useGameStore((state) => state.selection.selectedCards);
  const isReady = useGameStore((state) => state.selection.isReady);
  const setSelectionReady = useGameStore((state) => state.setSelectionReady);
  const toggleCardSelection = useGameStore(
    (state) => state.toggleCardSelection
  );
  const confirmCardSelection = useGameStore(
    (state) => state.confirmCardSelection
  );
  const viewContainerRef = useRef<HTMLDivElement>(null);

  useStageScroll(`${currentPlayer}:${isReady}`);

  if (!isReady) {
    return (
      <PrivateHandoff
        currentPlayer={currentPlayer}
        players={players}
        cardsPerPlayer={cardsPerPlayer}
        onReady={() => setSelectionReady(true)}
        containerRef={viewContainerRef}
      />
    );
  }

  return (
    <CardPicker
      currentPlayer={currentPlayer}
      players={players}
      cardsPerPlayer={cardsPerPlayer}
      availableCards={availableCards}
      selectedCards={selectedCards}
      onToggleCard={toggleCardSelection}
      onNextPlayer={confirmCardSelection}
      containerRef={viewContainerRef}
    />
  );
}
