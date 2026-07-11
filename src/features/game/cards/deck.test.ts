import { describe, expect, it, vi } from 'vitest';

import type { Card } from '../domain/game-types';
import {
  excludeCardsByWord,
  getSelectionOptions,
  rotateTopCardToBack,
  shuffleCards,
  uniqueCardsByWord,
} from './deck';

const cards: Card[] = [
  { level: 1, word: 'A', description: 'First' },
  { level: 2, word: 'B', description: 'Second' },
  { level: 3, word: 'C', description: 'Third' },
  { level: 4, word: 'D', description: 'Fourth' },
];

describe('deck operations', () => {
  it('keeps one catalog entry per word using the latest card data', () => {
    const duplicate = { ...cards[0], level: 4 as const, description: 'Latest' };

    expect(uniqueCardsByWord([...cards, duplicate])).toEqual([
      duplicate,
      ...cards.slice(1),
    ]);
  });

  it('shuffles a copy using the injected random source', () => {
    const random = vi.fn(() => 0.5);
    const shuffled = shuffleCards(cards, random);

    expect(shuffled).toEqual(cards);
    expect(shuffled).not.toBe(cards);
    expect(random).toHaveBeenCalled();
    expect(cards.map((card) => card.word)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('deals two extra choices without globally chosen cards', () => {
    const catalog = [
      ...cards,
      { level: 1 as const, word: 'E', description: '' },
    ];

    expect(excludeCardsByWord(catalog, [cards[0]])).not.toContain(cards[0]);
    expect(
      getSelectionOptions(catalog, [cards[0]], 1, () => 0.5).map(
        (card) => card.word
      )
    ).toEqual(['B', 'C', 'D']);
  });

  it('rotates only the top card to the back', () => {
    expect(rotateTopCardToBack(cards)).toEqual([
      cards[1],
      cards[2],
      cards[3],
      cards[0],
    ]);
    expect(rotateTopCardToBack([cards[0]])).toEqual([cards[0]]);
    expect(rotateTopCardToBack([])).toEqual([]);
  });
});
