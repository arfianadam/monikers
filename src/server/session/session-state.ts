import type { RandomSource } from '@/features/game/cards/deck';
import type {
  Card,
  RoundNumber,
  ScoresByRound,
  TeamId,
} from '@/features/game/domain/game-types';
import { createEmptyScores } from '@/features/game/domain/scoring';
import type {
  CommandError,
  ServerEvent,
  SessionConfiguration,
  SessionMode,
  SessionPhase,
} from '@/features/game/session-protocol/types';

export const CONTROLLER_GRACE_MS = 30_000;
export const CLUE_GIVER_GRACE_MS = 30_000;
export const TURN_DURATION_MS = 60_000;
export const CORRECT_COOLDOWN_MS = 1_000;

export interface SessionGameState {
  selectionSequence: number;
  turnSequence: number;
  chosenDeck: Card[];
  round: RoundNumber;
  scores: ScoresByRound;
  remainingCards: Card[];
  turn: SessionTurnState | null;
}

export interface SessionTurnState {
  id: number;
  currentTeam: TeamId;
  clueGiverId: string | null;
  clueGiverWaitEndsAt: number | null;
  active: boolean;
  startedAt: number | null;
  endsAt: number | null;
  guessedCards: Card[];
  canSkip: boolean;
  lastCorrectAt: number | null;
}

export interface SingleDeviceSelectionState {
  id: number;
  currentPlayer: number;
  offer: Card[];
  draft: Card[];
  revealed: boolean;
}

export interface OwnDeviceSelectionState {
  id: number;
  participantIds: string[];
  offers: Record<string, Card[]>;
  drafts: Record<string, Card[]>;
  confirmedParticipantIds: string[];
}

export interface OwnDeviceParticipantState {
  id: string;
  displayName: string;
  team: TeamId;
  joinOrder: number;
  ready: boolean;
  connected: boolean;
  connectedAt: number | null;
  disconnectedAt: number | null;
  departureStatus: 'active' | 'departed';
}

interface SessionStateBase {
  sessionId: string;
  mode: SessionMode;
  phase: SessionPhase;
  revision: number;
  createdAt: number;
  controllerId: string;
  configuration: SessionConfiguration;
  game: SessionGameState;
}

export interface SingleDeviceSessionState extends SessionStateBase {
  mode: 'single-device';
  phase:
    'setup' | 'selection' | 'turn' | 'round-score' | 'final-score' | 'ended';
  selection: SingleDeviceSelectionState | null;
}

export interface OwnDeviceSessionState extends SessionStateBase {
  mode: 'own-device';
  phase:
    | 'pending'
    | 'lobby'
    | 'selection'
    | 'turn'
    | 'round-score'
    | 'final-score'
    | 'ended';
  joinCode: string;
  participants: Record<string, OwnDeviceParticipantState>;
  teamOrder: Record<TeamId, string[]>;
  frozenTeamOrder: Record<TeamId, string[]> | null;
  clueGiverCursors: Record<TeamId, number>;
  nextTeamOnTie: TeamId;
  nextJoinOrder: number;
  selection: OwnDeviceSelectionState | null;
}

export type SessionState = SingleDeviceSessionState | OwnDeviceSessionState;

export interface SessionDependencies {
  catalog: readonly Card[];
  random?: RandomSource;
}

export type SessionMutationResult<T extends SessionState = SessionState> =
  | {
      state: T;
      error?: undefined;
      events?: ServerEvent[];
      revokedActorIds?: string[];
    }
  | {
      state: T;
      error: CommandError;
      events?: ServerEvent[];
      revokedActorIds?: string[];
    };

export interface CreatePendingSessionOptions {
  sessionId: string;
  mode: SessionMode;
  controllerId: string;
  now: number;
}

function createInitialGameState(): SessionGameState {
  return {
    selectionSequence: 0,
    turnSequence: 0,
    chosenDeck: [],
    round: 1,
    scores: createEmptyScores(),
    remainingCards: [],
    turn: null,
  };
}

export function createPendingSession({
  sessionId,
  mode,
  controllerId,
  now,
}: CreatePendingSessionOptions): SessionState {
  const common = {
    sessionId,
    revision: 0,
    createdAt: now,
    controllerId,
    configuration: { players: 4, cardsPerPlayer: 5 },
    game: createInitialGameState(),
  };

  if (mode === 'single-device') {
    return {
      ...common,
      mode,
      phase: 'setup',
      selection: null,
    };
  }

  return {
    ...common,
    mode,
    phase: 'pending',
    joinCode: '',
    participants: {},
    teamOrder: { team1: [], team2: [] },
    frozenTeamOrder: null,
    clueGiverCursors: { team1: 0, team2: 0 },
    nextTeamOnTie: 'team1',
    nextJoinOrder: 1,
    selection: null,
  };
}

export function normalizeDisplayName(displayName: string): string {
  return displayName.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

export function countGraphemes(value: string): number {
  return Array.from(
    new Intl.Segmenter('id', { granularity: 'grapheme' }).segment(value)
  ).length;
}

export function validateDisplayName(displayName: string): CommandError | null {
  const normalizedName = normalizeDisplayName(displayName);
  const length = countGraphemes(normalizedName);
  const withoutEmojiJoiners = normalizedName.replace(/[\u200C\u200D]/gu, '');

  if (
    length < 1 ||
    length > 24 ||
    /[\p{Cc}\p{Cf}]/u.test(withoutEmojiJoiners)
  ) {
    return {
      code: 'INVALID_NAME',
      message: 'Nama harus terdiri dari 1 sampai 24 karakter.',
    };
  }

  return null;
}

function hasDisplayName(
  state: OwnDeviceSessionState,
  displayName: string,
  exceptParticipantId?: string
): boolean {
  const comparableName =
    normalizeDisplayName(displayName).toLocaleLowerCase('id-ID');

  return Object.values(state.participants).some(
    (participant) =>
      participant.id !== exceptParticipantId &&
      participant.departureStatus === 'active' &&
      participant.displayName.toLocaleLowerCase('id-ID') === comparableName
  );
}

function createParticipant(
  participantId: string,
  displayName: string,
  team: TeamId,
  joinOrder: number,
  now: number
): OwnDeviceParticipantState {
  return {
    id: participantId,
    displayName: normalizeDisplayName(displayName),
    team,
    joinOrder,
    ready: false,
    connected: false,
    connectedAt: null,
    disconnectedAt: now,
    departureStatus: 'active',
  };
}

export interface ActivateOwnDeviceSessionOptions {
  participantId: string;
  displayName: string;
  joinCode: string;
  now: number;
}

export function activateOwnDeviceSession(
  state: OwnDeviceSessionState,
  { participantId, displayName, joinCode, now }: ActivateOwnDeviceSessionOptions
): SessionMutationResult<OwnDeviceSessionState> {
  if (state.phase !== 'pending' || participantId !== state.controllerId) {
    return {
      state,
      error: {
        code: 'INVALID_PHASE',
        message: 'Sesi ini tidak dapat diaktifkan lagi.',
      },
    };
  }

  const nameError = validateDisplayName(displayName);
  if (nameError) return { state, error: nameError };

  const participant = createParticipant(
    participantId,
    displayName,
    'team1',
    state.nextJoinOrder,
    now
  );

  return {
    state: {
      ...state,
      phase: 'lobby',
      revision: state.revision + 1,
      joinCode,
      configuration: { ...state.configuration, players: 1 },
      participants: { [participantId]: participant },
      teamOrder: { team1: [participantId], team2: [] },
      nextJoinOrder: state.nextJoinOrder + 1,
    },
  };
}

export interface AddOwnDeviceParticipantOptions {
  participantId: string;
  displayName: string;
  now: number;
}

function resetAllReadiness(
  participants: Record<string, OwnDeviceParticipantState>
): Record<string, OwnDeviceParticipantState> {
  return Object.fromEntries(
    Object.entries(participants).map(([id, participant]) => [
      id,
      participant.ready ? { ...participant, ready: false } : participant,
    ])
  );
}

export function addOwnDeviceParticipant(
  state: OwnDeviceSessionState,
  { participantId, displayName, now }: AddOwnDeviceParticipantOptions
): SessionMutationResult<OwnDeviceSessionState> {
  if (state.phase !== 'lobby') {
    return {
      state,
      error: {
        code: 'INVALID_PHASE',
        message: 'Permainan sudah dimulai.',
      },
    };
  }

  const activeParticipants = Object.values(state.participants).filter(
    (participant) => participant.departureStatus === 'active'
  );
  if (activeParticipants.length >= 20) {
    return {
      state,
      error: {
        code: 'INVALID_CONFIGURATION',
        message: 'Sesi ini sudah penuh.',
      },
    };
  }

  if (state.participants[participantId]) {
    return {
      state,
      error: {
        code: 'INVALID_COMMAND',
        message: 'Perangkat ini sudah menjadi anggota sesi.',
      },
    };
  }

  const nameError = validateDisplayName(displayName);
  if (nameError) return { state, error: nameError };
  if (hasDisplayName(state, displayName)) {
    return {
      state,
      error: {
        code: 'NAME_TAKEN',
        message: 'Nama tersebut sudah digunakan di sesi ini.',
      },
    };
  }

  const team1Size = state.teamOrder.team1.length;
  const team2Size = state.teamOrder.team2.length;
  const team =
    team1Size < team2Size
      ? 'team1'
      : team2Size < team1Size
        ? 'team2'
        : state.nextTeamOnTie;
  const usedTieBreak = team1Size === team2Size;
  const participant = createParticipant(
    participantId,
    displayName,
    team,
    state.nextJoinOrder,
    now
  );
  const participants = resetAllReadiness({
    ...state.participants,
    [participantId]: participant,
  });

  return {
    state: {
      ...state,
      revision: state.revision + 1,
      configuration: {
        ...state.configuration,
        players: activeParticipants.length + 1,
      },
      participants,
      teamOrder: {
        ...state.teamOrder,
        [team]: [...state.teamOrder[team], participantId],
      },
      nextTeamOnTie: usedTieBreak
        ? state.nextTeamOnTie === 'team1'
          ? 'team2'
          : 'team1'
        : state.nextTeamOnTie,
      nextJoinOrder: state.nextJoinOrder + 1,
    },
  };
}

export function replaceJoinCode(
  state: OwnDeviceSessionState,
  joinCode: string
): OwnDeviceSessionState {
  if (state.joinCode === joinCode) return state;
  return { ...state, joinCode, revision: state.revision + 1 };
}

export function createFreshGameState(
  state: SessionState,
  options: { preserveSequences?: boolean } = {}
): SessionGameState {
  const fresh = createInitialGameState();
  if (!options.preserveSequences) return fresh;

  return {
    ...fresh,
    selectionSequence: state.game.selectionSequence,
    turnSequence: state.game.turnSequence,
  };
}

export const defaultRandom: RandomSource = Math.random;
