import { describe, expect, it } from 'vitest';

import {
  displayNamesMatch,
  isJoinCode,
  normalizeDisplayName,
  normalizeJoinCode,
} from './session-identifiers';

describe('session identifiers', () => {
  it('normalizes human-formatted join codes without accepting ambiguous symbols', () => {
    expect(normalizeJoinCode(' ab-c 23 ')).toBe('ABC23');
    expect(isJoinCode('ab-c234')).toBe(true);
    expect(isJoinCode('ABCI23')).toBe(false);
  });

  it('validates display names by Unicode grapheme rather than code units', () => {
    expect(normalizeDisplayName('  Siti   Nur  ')).toBe('Siti Nur');
    expect(normalizeDisplayName('👨‍👩‍👧‍👦')).toBe('👨‍👩‍👧‍👦');
    expect(normalizeDisplayName('a'.repeat(25))).toBeNull();
    expect(normalizeDisplayName('Nama\u0000')).toBeNull();
  });

  it('compares names case-insensitively after Unicode normalization', () => {
    expect(displayNamesMatch('Éka', 'E\u0301KA')).toBe(true);
  });
});
