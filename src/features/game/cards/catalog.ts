import cardsLevel1 from './data/cards-level1.json';
import cardsLevel2 from './data/cards-level2.json';
import cardsLevel3 from './data/cards-level3.json';
import cardsLevel4 from './data/cards-level4.json';
import cardsLevel5 from './data/cards-level5.json';
import type { Card, CardLevel } from '../domain/game-types';
import { uniqueCardsByWord } from './deck';

interface CatalogEntry {
  level: number;
  word: string;
  description: string;
}

function toCard(entry: CatalogEntry): Card {
  if (![1, 2, 3, 4, 5].includes(entry.level)) {
    throw new Error(`Invalid card level for "${entry.word}": ${entry.level}`);
  }

  return {
    ...entry,
    level: entry.level as CardLevel,
  };
}

export const CARD_CATALOG: readonly Card[] = uniqueCardsByWord(
  [
    ...cardsLevel1,
    ...cardsLevel2,
    ...cardsLevel3,
    ...cardsLevel4,
    ...cardsLevel5,
  ].map(toCard)
);
