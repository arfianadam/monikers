import { describe, expect, it } from 'vitest';
import { CARD_CATALOG } from './catalog';

describe('card catalog', () => {
  it('contains 120 unique, described cards at every difficulty level', () => {
    expect(CARD_CATALOG).toHaveLength(600);
    expect(new Set(CARD_CATALOG.map((card) => card.word)).size).toBe(600);

    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(CARD_CATALOG.filter((card) => card.level === level)).toHaveLength(
        120
      );
    }

    for (const card of CARD_CATALOG) {
      expect(card.word.trim()).not.toBe('');
      expect(card.description.trim()).not.toBe('');
    }
  });
});
