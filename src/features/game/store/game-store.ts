import { createStore, type StoreApi } from 'zustand/vanilla';

import { CARD_CATALOG } from '../cards/catalog';
import { uniqueCardsByWord, type RandomSource } from '../cards/deck';
import type { Card } from '../domain/game-types';
import { createInitialGameState, type GameStore } from './game-state';
import {
  transitionConfirmCardSelection,
  transitionSetSelectionReady,
  transitionToggleCardSelection,
} from './selection-transitions';
import {
  transitionPlayAgain,
  transitionSetCardsPerPlayer,
  transitionSetPlayers,
  transitionStartGame,
  transitionStartNextRound,
} from './session-transitions';
import {
  transitionEndTurn,
  transitionExpireTurn,
  transitionGuessCard,
  transitionSkipCard,
  transitionStartTurn,
  transitionTickTimer,
} from './turn-transitions';

export type GameStoreApi = StoreApi<GameStore>;

export interface GameStoreOptions {
  catalog?: readonly Card[];
  random?: RandomSource;
}

export type {
  GameActions,
  GameState,
  GameStore,
  SelectionState,
  SetupState,
  TurnState,
} from './game-state';
export { createInitialGameState } from './game-state';

export function createGameStore(options: GameStoreOptions = {}): GameStoreApi {
  const catalog = uniqueCardsByWord(options.catalog ?? CARD_CATALOG);
  const random = options.random ?? Math.random;

  return createStore<GameStore>()((set, get) => ({
    ...createInitialGameState(),

    setPlayers: (players) => {
      set(transitionSetPlayers(get(), players));
    },

    setCardsPerPlayer: (cardsPerPlayer) => {
      set(transitionSetCardsPerPlayer(get(), cardsPerPlayer));
    },

    startGame: (players, cardsPerPlayer) => {
      set(
        transitionStartGame(get(), {
          players,
          cardsPerPlayer,
          catalog,
          random,
        })
      );
    },

    setSelectionReady: (isReady) => {
      const transition = transitionSetSelectionReady(get(), isReady);
      if (transition) set(transition);
    },

    toggleCardSelection: (card) => {
      const transition = transitionToggleCardSelection(get(), card);
      if (transition) set(transition);
    },

    confirmCardSelection: () => {
      const transition = transitionConfirmCardSelection(get(), {
        catalog,
        random,
      });
      if (transition) set(transition);
    },

    startTurn: () => {
      const transition = transitionStartTurn(get());
      if (transition) set(transition);
    },

    tickTimer: () => {
      const transition = transitionTickTimer(get());
      if (transition) set(transition);
    },

    expireTurn: () => {
      const transition = transitionExpireTurn(get());
      if (transition) set(transition);
    },

    guessCard: () => {
      const transition = transitionGuessCard(get());
      if (transition) set(transition);
    },

    skipCard: () => {
      const transition = transitionSkipCard(get());
      if (transition) set(transition);
    },

    endTurn: () => {
      const transition = transitionEndTurn(get());
      if (transition) set(transition);
    },

    startNextRound: () => {
      const transition = transitionStartNextRound(get(), random);
      if (transition) set(transition);
    },

    playAgain: () => {
      set(transitionPlayAgain());
    },
  }));
}
