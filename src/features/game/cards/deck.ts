import type { Card } from '../domain/game-types';

export type RandomSource = () => number;

export function uniqueCardsByWord(cards: readonly Card[]): Card[] {
  return Array.from(
    new Map(cards.map((card) => [card.word, card] as const)).values()
  );
}

export function shuffleCards(
  cards: readonly Card[],
  random: RandomSource = Math.random
): Card[] {
  return [...cards].sort(() => 0.5 - random());
}

export function excludeCardsByWord(
  cards: readonly Card[],
  excludedCards: readonly Card[]
): Card[] {
  const excludedWords = new Set(excludedCards.map((card) => card.word));
  return cards.filter((card) => !excludedWords.has(card.word));
}

export function getSelectionOptions(
  catalog: readonly Card[],
  chosenCards: readonly Card[],
  cardsPerPlayer: number,
  random: RandomSource = Math.random
): Card[] {
  const availableCards = excludeCardsByWord(catalog, chosenCards);
  return shuffleCards(availableCards, random).slice(0, cardsPerPlayer + 2);
}

export function rotateTopCardToBack(cards: readonly Card[]): Card[] {
  if (cards.length < 2) return [...cards];

  const [topCard, ...remainingCards] = cards;
  return [...remainingCards, topCard];
}
