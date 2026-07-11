import { rotateTopCardToBack } from '../cards/deck';
import type { Card, TeamId } from '../domain/game-types';
import { ROUND_DURATION_SECONDS } from '../domain/rounds';
import { addCardsToScore } from '../domain/scoring';
import type { GameState } from './game-state';

function otherTeam(team: TeamId): TeamId {
  return team === 'team1' ? 'team2' : 'team1';
}

interface FinishTurnOptions {
  remainingCards: Card[];
  guessedCards: Card[];
  timer?: number;
  canSkip?: boolean;
}

export function transitionFinishTurn(
  state: GameState,
  options: FinishTurnOptions
): Pick<GameState, 'scores' | 'stage' | 'turn'> {
  const scores = addCardsToScore(
    state.scores,
    state.turn.currentTeam,
    state.round,
    options.guessedCards
  );
  const roundIsComplete = options.remainingCards.length === 0;

  return {
    scores,
    stage: roundIsComplete
      ? state.round === 3
        ? 'final-score'
        : 'round-score'
      : 'turn',
    turn: {
      ...state.turn,
      remainingCards: options.remainingCards,
      guessedCards: [],
      currentTeam: roundIsComplete
        ? state.turn.currentTeam
        : otherTeam(state.turn.currentTeam),
      timer: options.timer ?? state.turn.timer,
      isActive: false,
      canSkip: options.canSkip ?? state.turn.canSkip,
    },
  };
}

export function transitionStartTurn(
  state: GameState
): Pick<GameState, 'turn'> | null {
  if (
    state.stage !== 'turn' ||
    state.turn.isActive ||
    state.turn.remainingCards.length === 0
  ) {
    return null;
  }

  return {
    turn: {
      ...state.turn,
      timer: ROUND_DURATION_SECONDS,
      isActive: true,
      canSkip: true,
    },
  };
}

export function transitionTickTimer(
  state: GameState
): Pick<GameState, 'turn'> | null {
  if (!state.turn.isActive || state.turn.timer <= 0) return null;

  return {
    turn: { ...state.turn, timer: state.turn.timer - 1 },
  };
}

export function transitionExpireTurn(
  state: GameState
): Pick<GameState, 'scores' | 'stage' | 'turn'> | null {
  if (!state.turn.isActive || state.turn.timer !== 0) return null;

  return transitionFinishTurn(state, {
    remainingCards: rotateTopCardToBack(state.turn.remainingCards),
    guessedCards: state.turn.guessedCards,
    timer: 0,
  });
}

export function transitionGuessCard(
  state: GameState
): Partial<GameState> | null {
  if (
    state.stage !== 'turn' ||
    !state.turn.isActive ||
    state.turn.remainingCards.length === 0
  ) {
    return null;
  }

  const [guessedCard, ...remainingCards] = state.turn.remainingCards;
  const guessedCards = [...state.turn.guessedCards, guessedCard];

  if (remainingCards.length === 0) {
    return transitionFinishTurn(state, {
      remainingCards,
      guessedCards,
      canSkip: true,
    });
  }

  return {
    turn: {
      ...state.turn,
      remainingCards,
      guessedCards,
      canSkip: true,
    },
  };
}

export function transitionSkipCard(
  state: GameState
): Pick<GameState, 'turn'> | null {
  if (
    state.stage !== 'turn' ||
    !state.turn.isActive ||
    !state.turn.canSkip ||
    state.turn.remainingCards.length <= 1
  ) {
    return null;
  }

  return {
    turn: {
      ...state.turn,
      remainingCards: rotateTopCardToBack(state.turn.remainingCards),
      canSkip: false,
    },
  };
}

export function transitionEndTurn(
  state: GameState
): Pick<GameState, 'scores' | 'stage' | 'turn'> | null {
  if (state.stage !== 'turn' || !state.turn.isActive) return null;

  return transitionFinishTurn(state, {
    remainingCards: state.turn.remainingCards,
    guessedCards: state.turn.guessedCards,
  });
}
