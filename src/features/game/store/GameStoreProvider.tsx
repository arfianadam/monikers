'use client';

import { createContext, type ReactNode, useContext, useRef } from 'react';
import { useStore } from 'zustand';

import {
  createGameStore,
  type GameStore,
  type GameStoreApi,
  type GameStoreOptions,
} from './game-store';

const GameStoreContext = createContext<GameStoreApi | null>(null);

interface GameStoreProviderProps extends GameStoreOptions {
  children: ReactNode;
  store?: GameStoreApi;
}

export function GameStoreProvider({
  children,
  store,
  catalog,
  random,
}: GameStoreProviderProps) {
  const storeRef = useRef<GameStoreApi | null>(null);

  if (storeRef.current === null) {
    storeRef.current = store ?? createGameStore({ catalog, random });
  }

  return (
    <GameStoreContext.Provider value={storeRef.current}>
      {children}
    </GameStoreContext.Provider>
  );
}

export function useGameStoreApi(): GameStoreApi {
  const store = useContext(GameStoreContext);

  if (store === null) {
    throw new Error('useGameStore must be used within GameStoreProvider');
  }

  return store;
}

export function useGameStore<T>(selector: (state: GameStore) => T): T {
  return useStore(useGameStoreApi(), selector);
}
