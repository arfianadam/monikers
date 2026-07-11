import type {
  Card,
  RoundNumber,
  ScoresByRound,
  TeamId,
} from '@/features/game/domain/game-types';

export type SessionMode = 'single-device' | 'own-device';

export type SessionPhase =
  | 'pending'
  | 'setup'
  | 'lobby'
  | 'selection'
  | 'turn'
  | 'round-score'
  | 'final-score'
  | 'ended';

export type ParticipantPresence = 'connected' | 'disconnected' | 'departed';

export interface SessionConfiguration {
  players: number;
  cardsPerPlayer: number;
}

export interface ParticipantProjection {
  id: string;
  displayName: string;
  team: TeamId;
  ready: boolean;
  presence: ParticipantPresence;
  isController: boolean;
}

export type CommandErrorCode =
  | 'INVALID_COMMAND'
  | 'RATE_LIMITED'
  | 'SESSION_ENDED'
  | 'NOT_AUTHORIZED'
  | 'INVALID_PHASE'
  | 'STALE_REVISION'
  | 'STALE_SELECTION'
  | 'STALE_TURN'
  | 'INVALID_CONFIGURATION'
  | 'INVALID_NAME'
  | 'NAME_TAKEN'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_DEPARTED'
  | 'PLAYER_DISCONNECTED'
  | 'ROOM_NOT_READY'
  | 'TEAM_UNAVAILABLE'
  | 'CARD_NOT_OFFERED'
  | 'CARD_COUNT_INVALID'
  | 'SELECTION_CONFIRMED'
  | 'TURN_NOT_ACTIVE'
  | 'CARD_MISMATCH'
  | 'SKIP_UNAVAILABLE'
  | 'CORRECT_COOLDOWN';

export interface CommandError {
  code: CommandErrorCode;
  message: string;
}

interface CommandBase {
  id: string;
  expectedRevision?: number;
}

export interface UpdateSetupCommand extends CommandBase {
  type: 'update-setup';
  players?: number;
  cardsPerPlayer?: number;
}

export interface SetReadyCommand extends CommandBase {
  type: 'set-ready';
  ready: boolean;
}

export interface RenamePlayerCommand extends CommandBase {
  type: 'rename-player';
  displayName: string;
}

export interface MovePlayerCommand extends CommandBase {
  type: 'move-player';
  playerId: string;
  team: TeamId;
}

export interface ReorderPlayerCommand extends CommandBase {
  type: 'reorder-player';
  playerId: string;
  direction: 'up' | 'down';
}

export interface RemovePlayerCommand extends CommandBase {
  type: 'remove-player';
  playerId: string;
}

export interface RotateCodeCommand extends CommandBase {
  type: 'rotate-code';
}

export interface StartSelectionCommand extends CommandBase {
  type: 'start-selection';
}

export interface RevealSingleOfferCommand extends CommandBase {
  type: 'reveal-single-offer';
  selectionId: number;
}

export interface ToggleCardCommand extends CommandBase {
  type: 'toggle-card';
  selectionId: number;
  cardWord: string;
}

export interface ConfirmSelectionCommand extends CommandBase {
  type: 'confirm-selection';
  selectionId: number;
}

export interface CancelSelectionCommand extends CommandBase {
  type: 'cancel-selection';
  selectionId: number;
}

interface TurnCommandBase extends CommandBase {
  turnId: number;
}

export interface StartTurnCommand extends TurnCommandBase {
  type: 'start-turn';
}

export interface CorrectCommand extends TurnCommandBase {
  type: 'correct';
  cardWord: string;
}

export interface SkipCommand extends TurnCommandBase {
  type: 'skip';
  cardWord: string;
}

export interface EndTurnCommand extends TurnCommandBase {
  type: 'end-turn';
}

export interface NextRoundCommand extends CommandBase {
  type: 'next-round';
}

export interface ReplayCommand extends CommandBase {
  type: 'replay';
}

export interface ReturnLobbyCommand extends CommandBase {
  type: 'return-lobby';
}

export interface EndSessionCommand extends CommandBase {
  type: 'end-session';
}

export type SessionCommand =
  | UpdateSetupCommand
  | SetReadyCommand
  | RenamePlayerCommand
  | MovePlayerCommand
  | ReorderPlayerCommand
  | RemovePlayerCommand
  | RotateCodeCommand
  | StartSelectionCommand
  | RevealSingleOfferCommand
  | ToggleCardCommand
  | ConfirmSelectionCommand
  | CancelSelectionCommand
  | StartTurnCommand
  | CorrectCommand
  | SkipCommand
  | EndTurnCommand
  | NextRoundCommand
  | ReplayCommand
  | ReturnLobbyCommand
  | EndSessionCommand;

export interface CommandEnvelope {
  actorId: string;
  receivedAt: number;
  command: SessionCommand;
}

export type ServerEvent =
  | {
      type: 'sound';
      sound: 'bell' | 'ring';
      recipientId: string;
    }
  | {
      type: 'code-rotation-requested';
      requestedBy: string;
    }
  | {
      type: 'session-ended';
    };

export type CommandAcknowledgement =
  | {
      type: 'command-ack';
      commandId: string;
      ok: true;
      revision: number;
    }
  | {
      type: 'command-ack';
      commandId: string;
      ok: false;
      revision: number;
      error: CommandError;
    };

export interface ScorePointsProjection {
  team1: {
    total: number;
    rounds: Partial<Record<RoundNumber, number>>;
  };
  team2: {
    total: number;
    rounds: Partial<Record<RoundNumber, number>>;
  };
}

interface ProjectionBase {
  sessionId: string;
  mode: SessionMode;
  recipientId: string | null;
  isController: boolean;
  version: number;
  serverTime: number;
}

export interface PendingProjection extends ProjectionBase {
  phase: 'pending';
  canActivate: boolean;
}

export interface SetupProjection extends ProjectionBase {
  mode: 'single-device';
  phase: 'setup';
  configuration: SessionConfiguration;
  canManage: boolean;
}

export interface LobbyProjection extends ProjectionBase {
  mode: 'own-device';
  phase: 'lobby';
  configuration: SessionConfiguration;
  joinCode: string;
  controllerId: string;
  participants: ParticipantProjection[];
  teamOrder: Record<TeamId, string[]>;
  canManage: boolean;
  roomReady: boolean;
  canStart: boolean;
}

export interface SelectionStatusProjection {
  participantId: string;
  displayName: string;
  status: 'selecting' | 'done';
}

export interface SelectionProjection extends ProjectionBase {
  phase: 'selection';
  selectionId: number;
  configuration: SessionConfiguration;
  statuses: SelectionStatusProjection[];
  currentPlayer?: number;
  offer?: Card[];
  draft?: Card[];
  confirmed: boolean;
  blockedParticipantIds: string[];
  canReveal?: boolean;
  canEdit: boolean;
  canCancel: boolean;
}

export interface TurnProjection extends ProjectionBase {
  phase: 'turn';
  round: RoundNumber;
  currentTeam: TeamId;
  clueGiverId: string | null;
  clueGiverName: string | null;
  turnId: number;
  turnActive: boolean;
  turnEndsAt: number | null;
  clueGiverWaitEndsAt: number | null;
  initialCardCount: number;
  remainingCardCount: number;
  guessedCardCount: number;
  scores: ScorePointsProjection;
  card?: Card;
  controls?: {
    canStart: boolean;
    canMarkCorrect: boolean;
    canSkip: boolean;
    canEnd: boolean;
  };
}

export interface ScoreProjection extends ProjectionBase {
  phase: 'round-score' | 'final-score';
  round: RoundNumber;
  scores: ScoresByRound;
  canContinue: boolean;
}

export interface EndedProjection extends ProjectionBase {
  phase: 'ended';
}

export type SessionProjection =
  | PendingProjection
  | SetupProjection
  | LobbyProjection
  | SelectionProjection
  | TurnProjection
  | ScoreProjection
  | EndedProjection;

export type ServerMessage =
  | { type: 'projection'; projection: SessionProjection }
  | CommandAcknowledgement
  | { type: 'event'; event: ServerEvent };
