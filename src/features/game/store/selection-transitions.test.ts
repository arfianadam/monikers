import { describe, expect, it } from 'vitest';

import type { Card } from '../domain/game-types';
import { createInitialGameState, type GameState } from './game-state';
import {
  transitionConfirmCardSelection,
  transitionSetSelectionReady,
  transitionToggleCardSelection,
} from './selection-transitions';
import { transitionStartGame } from './session-transitions';

const catalog: Card[] = [
  { level: 1, word: 'A', description: 'First' },
  { level: 2, word: 'B', description: 'Second' },
  { level: 3, word: 'C', description: 'Third' },
];
const keepOrder = () => 0.5;

function applyTransition(
  state: GameState,
  transition: Partial<GameState> | null
): GameState {
  if (transition === null) return state;
  return { ...state, ...transition };
}

function createSelectionState(): GameState {
  return transitionStartGame(createInitialGameState(), {
    players: 2,
    cardsPerPlayer: 1,
    catalog,
    random: keepOrder,
  });
}

describe('selection transitions', () => {
  it('rejects card changes before the current player is ready', () => {
    const state = createSelectionState();
    const card = state.selection.availableCards[0];

    expect(transitionToggleCardSelection(state, card)).toBeNull();
    expect(
      transitionConfirmCardSelection(state, {
        catalog,
        random: keepOrder,
      })
    ).toBeNull();
  });

  it('rejects confirmation after returning to the private handoff', () => {
    let state = createSelectionState();
    const card = state.selection.availableCards[0];

    state = applyTransition(state, transitionSetSelectionReady(state, true));
    state = applyTransition(state, transitionToggleCardSelection(state, card));
    state = applyTransition(state, transitionSetSelectionReady(state, false));

    expect(state.selection.selectedCards).toEqual([card]);
    expect(
      transitionConfirmCardSelection(state, {
        catalog,
        random: keepOrder,
      })
    ).toBeNull();
  });

  it('advances without mutating the ready selection state', () => {
    let state = createSelectionState();
    const card = state.selection.availableCards[0];

    state = applyTransition(state, transitionSetSelectionReady(state, true));
    state = applyTransition(state, transitionToggleCardSelection(state, card));
    const transition = transitionConfirmCardSelection(state, {
      catalog,
      random: keepOrder,
    });

    expect(transition).toMatchObject({
      chosenDeck: [card],
      selection: {
        currentPlayer: 2,
        selectedCards: [],
        isReady: false,
      },
    });
    expect(state.chosenDeck).toEqual([]);
    expect(state.selection.selectedCards).toEqual([card]);
  });
});
