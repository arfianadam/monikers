'use client';

import { GameStoreProvider } from '@/features/game/store/GameStoreProvider';

import { GameSession } from '../GameSession/GameSession';

export function GameApp() {
  return (
    <GameStoreProvider>
      <GameSession />
    </GameStoreProvider>
  );
}
