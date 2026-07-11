import type { Card } from '../domain/game-types';
import { getNextRound } from '../domain/rounds';
import { createEmptyScores } from '../domain/scoring';
import {
  getSelectionOptions,
  shuffleCards,
  type RandomSource,
} from '../cards/deck';
import {
  createInitialGameState,
  createInitialTurnState,
  type GameState,
} from './game-state';

export function transitionSetPlayers(
  state: GameState,
  players: number
): Pick<GameState, 'setup'> {
  return {
    setup: { ...state.setup, players },
  };
}

export function transitionSetCardsPerPlayer(
  state: GameState,
  cardsPerPlayer: number
): Pick<GameState, 'setup'> {
  return {
    setup: { ...state.setup, cardsPerPlayer },
  };
}

interface StartGameOptions {
  players?: number;
  cardsPerPlayer?: number;
  catalog: readonly Card[];
  random: RandomSource;
}

export function transitionStartGame(
  state: GameState,
  { players, cardsPerPlayer, catalog, random }: StartGameOptions
): GameState {
  const setup = {
    players: players ?? state.setup.players,
    cardsPerPlayer: cardsPerPlayer ?? state.setup.cardsPerPlayer,
  };

  return {
    stage: 'card-selection',
    setup,
    selection: {
      currentPlayer: 1,
      availableCards: getSelectionOptions(
        catalog,
        [],
        setup.cardsPerPlayer,
        random
      ),
      selectedCards: [],
      isReady: false,
    },
    chosenDeck: [],
    round: 1,
    scores: createEmptyScores(),
    turn: createInitialTurnState(),
  };
}

export function transitionStartNextRound(
  state: GameState,
  random: RandomSource
): Pick<GameState, 'stage' | 'round' | 'turn'> | null {
  if (state.stage !== 'round-score') return null;

  const round = getNextRound(state.round);
  if (round === null) return null;

  return {
    stage: 'turn',
    round,
    turn: {
      ...createInitialTurnState(),
      remainingCards: shuffleCards(state.chosenDeck, random),
    },
  };
}

export function transitionPlayAgain(): GameState {
  return createInitialGameState();
}
