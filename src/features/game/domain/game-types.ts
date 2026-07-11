export type CardLevel = 1 | 2 | 3 | 4;

export interface Card {
  level: CardLevel;
  word: string;
  description: string;
}

export type TeamId = 'team1' | 'team2';

export type RoundNumber = 1 | 2 | 3;

export type GameStage =
  'setup' | 'card-selection' | 'turn' | 'round-score' | 'final-score';

export type ScoresByRound = Record<
  TeamId,
  Partial<Record<RoundNumber, Card[]>>
>;
