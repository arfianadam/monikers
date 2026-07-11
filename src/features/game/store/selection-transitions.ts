import type { Card } from '../domain/game-types';
import {
  getSelectionOptions,
  shuffleCards,
  type RandomSource,
} from '../cards/deck';
import { createInitialTurnState, type GameState } from './game-state';

export function transitionSetSelectionReady(
  state: GameState,
  isReady: boolean
): Pick<GameState, 'selection'> | null {
  if (state.stage !== 'card-selection') return null;

  return {
    selection: { ...state.selection, isReady },
  };
}

export function transitionToggleCardSelection(
  state: GameState,
  card: Card
): Pick<GameState, 'selection'> | null {
  if (state.stage !== 'card-selection' || !state.selection.isReady) return null;
  if (
    !state.selection.availableCards.some(
      (availableCard) => availableCard.word === card.word
    )
  ) {
    return null;
  }

  const isSelected = state.selection.selectedCards.some(
    (selectedCard) => selectedCard.word === card.word
  );
  const selectedCards = isSelected
    ? state.selection.selectedCards.filter(
        (selectedCard) => selectedCard.word !== card.word
      )
    : state.selection.selectedCards.length < state.setup.cardsPerPlayer
      ? [...state.selection.selectedCards, card]
      : state.selection.selectedCards;

  return {
    selection: { ...state.selection, selectedCards },
  };
}

interface ConfirmCardSelectionOptions {
  catalog: readonly Card[];
  random: RandomSource;
}

export function transitionConfirmCardSelection(
  state: GameState,
  { catalog, random }: ConfirmCardSelectionOptions
): Partial<GameState> | null {
  if (state.stage !== 'card-selection' || !state.selection.isReady) return null;
  if (state.selection.selectedCards.length !== state.setup.cardsPerPlayer) {
    return null;
  }

  const chosenDeck = [...state.chosenDeck, ...state.selection.selectedCards];

  if (state.selection.currentPlayer < state.setup.players) {
    return {
      chosenDeck,
      selection: {
        currentPlayer: state.selection.currentPlayer + 1,
        availableCards: getSelectionOptions(
          catalog,
          chosenDeck,
          state.setup.cardsPerPlayer,
          random
        ),
        selectedCards: [],
        isReady: false,
      },
    };
  }

  return {
    stage: 'turn',
    chosenDeck,
    selection: {
      ...state.selection,
      selectedCards: [],
      isReady: false,
    },
    turn: {
      ...createInitialTurnState(),
      remainingCards: shuffleCards(chosenDeck, random),
    },
  };
}
