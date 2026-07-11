import type { Card, RoundNumber, ScoresByRound, TeamId } from './game-types';

export function createEmptyScores(): ScoresByRound {
  return {
    team1: {},
    team2: {},
  };
}

export function addCardsToScore(
  scores: ScoresByRound,
  team: TeamId,
  round: RoundNumber,
  cards: readonly Card[]
): ScoresByRound {
  return {
    ...scores,
    [team]: {
      ...scores[team],
      [round]: [...(scores[team][round] ?? []), ...cards],
    },
  };
}

export function getCardPoints(cards: readonly Card[]): number {
  return cards.reduce((total, card) => total + card.level, 0);
}

export function getTeamTotal(scores: ScoresByRound, team: TeamId): number {
  return Object.values(scores[team]).reduce(
    (total, cards) => total + getCardPoints(cards ?? []),
    0
  );
}

export function getScoredRounds(scores: ScoresByRound): RoundNumber[] {
  const rounds = new Set<RoundNumber>();

  for (const team of ['team1', 'team2'] as const) {
    for (const round of [1, 2, 3] as const) {
      if (scores[team][round]) rounds.add(round);
    }
  }

  return [...rounds].sort((first, second) => first - second);
}
