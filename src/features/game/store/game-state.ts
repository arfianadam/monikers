import type {
  Card,
  GameStage,
  RoundNumber,
  ScoresByRound,
  TeamId,
} from '../domain/game-types';
import { ROUND_DURATION_SECONDS } from '../domain/rounds';
import { createEmptyScores } from '../domain/scoring';

export interface SetupState {
  players: number;
  cardsPerPlayer: number;
}

export interface SelectionState {
  currentPlayer: number;
  availableCards: Card[];
  selectedCards: Card[];
  isReady: boolean;
}

export interface TurnState {
  remainingCards: Card[];
  guessedCards: Card[];
  currentTeam: TeamId;
  timer: number;
  isActive: boolean;
  canSkip: boolean;
}

export interface GameState {
  stage: GameStage;
  setup: SetupState;
  selection: SelectionState;
  chosenDeck: Card[];
  round: RoundNumber;
  scores: ScoresByRound;
  turn: TurnState;
}

export interface GameActions {
  setPlayers: (players: number) => void;
  setCardsPerPlayer: (cardsPerPlayer: number) => void;
  startGame: (players?: number, cardsPerPlayer?: number) => void;
  setSelectionReady: (isReady: boolean) => void;
  toggleCardSelection: (card: Card) => void;
  confirmCardSelection: () => void;
  startTurn: () => void;
  tickTimer: () => void;
  expireTurn: () => void;
  guessCard: () => void;
  skipCard: () => void;
  endTurn: () => void;
  startNextRound: () => void;
  playAgain: () => void;
}

export type GameStore = GameState & GameActions;

const DEFAULT_SETUP: Readonly<SetupState> = {
  players: 4,
  cardsPerPlayer: 5,
};

export function createInitialTurnState(): TurnState {
  return {
    remainingCards: [],
    guessedCards: [],
    currentTeam: 'team1',
    timer: ROUND_DURATION_SECONDS,
    isActive: false,
    canSkip: true,
  };
}

export function createInitialGameState(): GameState {
  return {
    stage: 'setup',
    setup: { ...DEFAULT_SETUP },
    selection: {
      currentPlayer: 1,
      availableCards: [],
      selectedCards: [],
      isReady: false,
    },
    chosenDeck: [],
    round: 1,
    scores: createEmptyScores(),
    turn: createInitialTurnState(),
  };
}
