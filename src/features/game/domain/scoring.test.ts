import { describe, expect, it } from 'vitest';

import type { Card } from './game-types';
import {
  addCardsToScore,
  createEmptyScores,
  getCardPoints,
  getScoredRounds,
  getTeamTotal,
} from './scoring';

const easyCard: Card = {
  level: 1,
  word: 'Easy',
  description: 'An easy card',
};
const hardCard: Card = {
  level: 4,
  word: 'Hard',
  description: 'A hard card',
};

describe('scoring', () => {
  it('creates a precise empty score for both teams', () => {
    expect(createEmptyScores()).toEqual({ team1: {}, team2: {} });
  });

  it('immutably appends cards to the team and round', () => {
    const initialScores = createEmptyScores();
    const firstScore = addCardsToScore(initialScores, 'team1', 1, [easyCard]);
    const secondScore = addCardsToScore(firstScore, 'team1', 1, [hardCard]);

    expect(initialScores).toEqual({ team1: {}, team2: {} });
    expect(secondScore.team1[1]).toEqual([easyCard, hardCard]);
    expect(secondScore.team2).toEqual({});
  });

  it('totals card points and reports scored rounds', () => {
    let scores = createEmptyScores();
    scores = addCardsToScore(scores, 'team1', 1, [easyCard, hardCard]);
    scores = addCardsToScore(scores, 'team2', 2, [hardCard]);

    expect(getCardPoints([easyCard, hardCard])).toBe(5);
    expect(getTeamTotal(scores, 'team1')).toBe(5);
    expect(getTeamTotal(scores, 'team2')).toBe(4);
    expect(getScoredRounds(scores)).toEqual([1, 2]);
  });
});
