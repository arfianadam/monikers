import { describe, expect, it } from 'vitest';
import { cardSchema } from './schemas';

describe('cardSchema', () => {
  it('accepts every supported card level', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      expect(
        cardSchema.safeParse({
          level,
          word: `Kartu ${level}`,
          description: 'Deskripsi kartu.',
        }).success
      ).toBe(true);
    }
  });

  it('rejects unsupported card levels', () => {
    expect(
      cardSchema.safeParse({
        level: 6,
        word: 'Kartu 6',
        description: 'Deskripsi kartu.',
      }).success
    ).toBe(false);
  });
});
