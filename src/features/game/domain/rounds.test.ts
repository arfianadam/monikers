import { describe, expect, it } from 'vitest';

import { getNextRound, isFinalRound, ROUND_DETAILS } from './rounds';

describe('rounds', () => {
  it('defines the three rounds and their instructions', () => {
    expect(ROUND_DETAILS[1].shortName).toBe('Bebas ngomong');
    expect(ROUND_DETAILS[2].shortName).toBe('Cuma satu kata');
    expect(ROUND_DETAILS[3].shortName).toBe('Pakai gaya');
  });

  it('advances until the final round', () => {
    expect(getNextRound(1)).toBe(2);
    expect(getNextRound(2)).toBe(3);
    expect(getNextRound(3)).toBeNull();
    expect(isFinalRound(2)).toBe(false);
    expect(isFinalRound(3)).toBe(true);
  });
});
