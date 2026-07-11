import { describe, expect, it } from 'vitest';

import type { Card } from '../domain/game-types';
import { createGameStore, type GameStoreApi } from './game-store';

const catalog: Card[] = [
  { level: 1, word: 'A', description: 'First' },
  { level: 2, word: 'B', description: 'Second' },
  { level: 3, word: 'C', description: 'Third' },
  { level: 4, word: 'D', description: 'Fourth' },
  { level: 1, word: 'E', description: 'Fifth' },
  { level: 2, word: 'F', description: 'Sixth' },
];

const keepOrder = () => 0.5;

function chooseFirstCard(store: GameStoreApi) {
  const card = store.getState().selection.availableCards[0];
  store.getState().setSelectionReady(true);
  store.getState().toggleCardSelection(card);
  store.getState().confirmCardSelection();
}

function createTwoCardGame(): GameStoreApi {
  const store = createGameStore({ catalog, random: keepOrder });
  store.getState().startGame(2, 1);
  chooseFirstCard(store);
  chooseFirstCard(store);
  return store;
}

function guessEntireDeck(store: GameStoreApi) {
  store.getState().startTurn();
  while (store.getState().turn.isActive) {
    store.getState().guessCard();
  }
}

describe('game store', () => {
  it('starts with the setup defaults and empty game state', () => {
    const state = createGameStore({ catalog }).getState();

    expect(state.stage).toBe('setup');
    expect(state.setup).toEqual({ players: 4, cardsPerPlayer: 5 });
    expect(state.chosenDeck).toEqual([]);
    expect(state.scores).toEqual({ team1: {}, team2: {} });
    expect(state.round).toBe(1);
    expect(state.turn).toMatchObject({
      remainingCards: [],
      guessedCards: [],
      currentTeam: 'team1',
      timer: 60,
      isActive: false,
      canSkip: true,
    });
  });

  it('runs private card selection and excludes globally chosen cards', () => {
    const store = createGameStore({ catalog, random: keepOrder });
    store.getState().startGame(2, 1);

    expect(store.getState().stage).toBe('card-selection');
    expect(store.getState().selection.availableCards).toHaveLength(3);

    const [firstCard, secondCard] = store.getState().selection.availableCards;
    store.getState().setSelectionReady(true);
    store.getState().toggleCardSelection(firstCard);
    store.getState().toggleCardSelection(secondCard);
    expect(store.getState().selection.selectedCards).toEqual([firstCard]);

    store.getState().confirmCardSelection();
    expect(store.getState().chosenDeck).toEqual([firstCard]);
    expect(store.getState().selection).toMatchObject({
      currentPlayer: 2,
      selectedCards: [],
      isReady: false,
    });
    expect(
      store
        .getState()
        .selection.availableCards.some((card) => card.word === firstCard.word)
    ).toBe(false);

    chooseFirstCard(store);
    expect(store.getState().stage).toBe('turn');
    expect(store.getState().chosenDeck).toHaveLength(2);
    expect(store.getState().turn.remainingCards).toEqual(
      store.getState().chosenDeck
    );
  });

  it('rejects selection actions until the current player is ready', () => {
    const store = createGameStore({ catalog, random: keepOrder });
    store.getState().startGame(2, 1);
    const card = store.getState().selection.availableCards[0];

    store.getState().toggleCardSelection(card);
    store.getState().confirmCardSelection();

    expect(store.getState().selection.selectedCards).toEqual([]);
    expect(store.getState().selection.currentPlayer).toBe(1);
    expect(store.getState().chosenDeck).toEqual([]);

    store.getState().setSelectionReady(true);
    store.getState().toggleCardSelection(card);
    store.getState().setSelectionReady(false);
    store.getState().confirmCardSelection();

    expect(store.getState().selection.selectedCards).toEqual([card]);
    expect(store.getState().selection.currentPlayer).toBe(1);
    expect(store.getState().chosenDeck).toEqual([]);
  });

  it('allows one skip until a correct guess and banks an early turn', () => {
    const store = createTwoCardGame();
    const [firstCard, secondCard] = store.getState().turn.remainingCards;

    store.getState().startTurn();
    store.getState().skipCard();
    expect(store.getState().turn.remainingCards).toEqual([
      secondCard,
      firstCard,
    ]);
    expect(store.getState().turn.canSkip).toBe(false);

    store.getState().skipCard();
    expect(store.getState().turn.remainingCards).toEqual([
      secondCard,
      firstCard,
    ]);

    store.getState().guessCard();
    expect(store.getState().turn.canSkip).toBe(true);
    store.getState().endTurn();

    expect(store.getState().stage).toBe('turn');
    expect(store.getState().turn.isActive).toBe(false);
    expect(store.getState().turn.currentTeam).toBe('team2');
    expect(store.getState().turn.guessedCards).toEqual([]);
    expect(store.getState().scores.team1[1]).toEqual([secondCard]);
  });

  it('rotates the active card and banks guesses when time expires', () => {
    const store = createGameStore({ catalog, random: keepOrder });
    store.getState().startGame(3, 1);
    chooseFirstCard(store);
    chooseFirstCard(store);
    chooseFirstCard(store);
    const [firstCard, secondCard, thirdCard] =
      store.getState().turn.remainingCards;

    store.getState().startTurn();
    store.getState().guessCard();
    for (let second = 0; second < 60; second += 1) {
      store.getState().tickTimer();
    }
    expect(store.getState().turn).toMatchObject({ timer: 0, isActive: true });
    store.getState().expireTurn();

    expect(store.getState().scores.team1[1]).toEqual([firstCard]);
    expect(store.getState().turn.remainingCards).toEqual([
      thirdCard,
      secondCard,
    ]);
    expect(store.getState().turn).toMatchObject({
      currentTeam: 'team2',
      timer: 0,
      isActive: false,
      guessedCards: [],
    });
  });

  it('shows round and final scores, reshuffling the original deck each round', () => {
    const store = createTwoCardGame();
    const chosenDeck = store.getState().chosenDeck;

    guessEntireDeck(store);
    expect(store.getState().stage).toBe('round-score');
    expect(store.getState().scores.team1[1]).toEqual(chosenDeck);

    store.getState().startNextRound();
    expect(store.getState()).toMatchObject({ stage: 'turn', round: 2 });
    expect(store.getState().turn.currentTeam).toBe('team1');
    expect(store.getState().turn.remainingCards).toEqual(chosenDeck);

    guessEntireDeck(store);
    store.getState().startNextRound();
    expect(store.getState().round).toBe(3);
    guessEntireDeck(store);

    expect(store.getState().stage).toBe('final-score');
    expect(store.getState().scores.team1[3]).toEqual(chosenDeck);
  });

  it('fully resets when playing again', () => {
    const store = createTwoCardGame();
    store.getState().playAgain();

    expect(store.getState()).toMatchObject({
      stage: 'setup',
      setup: { players: 4, cardsPerPlayer: 5 },
      chosenDeck: [],
      round: 1,
      scores: { team1: {}, team2: {} },
    });
    expect(store.getState().turn.remainingCards).toEqual([]);
  });
});
