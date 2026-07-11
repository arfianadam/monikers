import { z } from 'zod';

const commandIdSchema = z.string().min(1).max(128);
const expectedRevisionSchema = z.number().int().nonnegative().optional();
const commandBase = {
  id: commandIdSchema,
  expectedRevision: expectedRevisionSchema,
};

export const sessionModeSchema = z.enum(['single-device', 'own-device']);
export const sessionPhaseSchema = z.enum([
  'pending',
  'setup',
  'lobby',
  'selection',
  'turn',
  'round-score',
  'final-score',
  'ended',
]);
export const teamIdSchema = z.enum(['team1', 'team2']);
export const roundNumberSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export const participantPresenceSchema = z.enum([
  'connected',
  'disconnected',
  'departed',
]);

export const cardSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  word: z.string().min(1),
  description: z.string(),
});

export const sessionConfigurationSchema = z.object({
  players: z.number().int().min(1).max(20),
  cardsPerPlayer: z.number().int().min(1).max(10),
});

export const participantProjectionSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  team: teamIdSchema,
  ready: z.boolean(),
  presence: participantPresenceSchema,
  isController: z.boolean(),
});

export const sessionCommandSchema = z.discriminatedUnion('type', [
  z.object({
    ...commandBase,
    type: z.literal('update-setup'),
    players: z.number().int().min(2).max(20).optional(),
    cardsPerPlayer: z.number().int().min(1).max(10).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal('set-ready'),
    ready: z.boolean(),
  }),
  z.object({
    ...commandBase,
    type: z.literal('rename-player'),
    displayName: z.string().trim().min(1).max(96),
  }),
  z.object({
    ...commandBase,
    type: z.literal('move-player'),
    playerId: z.string().min(1),
    team: teamIdSchema,
  }),
  z.object({
    ...commandBase,
    type: z.literal('reorder-player'),
    playerId: z.string().min(1),
    direction: z.enum(['up', 'down']),
  }),
  z.object({
    ...commandBase,
    type: z.literal('remove-player'),
    playerId: z.string().min(1),
  }),
  z.object({ ...commandBase, type: z.literal('rotate-code') }),
  z.object({ ...commandBase, type: z.literal('start-selection') }),
  z.object({
    ...commandBase,
    type: z.literal('reveal-single-offer'),
    selectionId: z.number().int().positive(),
  }),
  z.object({
    ...commandBase,
    type: z.literal('toggle-card'),
    selectionId: z.number().int().positive(),
    cardWord: z.string().min(1),
  }),
  z.object({
    ...commandBase,
    type: z.literal('confirm-selection'),
    selectionId: z.number().int().positive(),
  }),
  z.object({
    ...commandBase,
    type: z.literal('cancel-selection'),
    selectionId: z.number().int().positive(),
  }),
  z.object({
    ...commandBase,
    type: z.literal('start-turn'),
    turnId: z.number().int().positive(),
  }),
  z.object({
    ...commandBase,
    type: z.literal('correct'),
    turnId: z.number().int().positive(),
    cardWord: z.string().min(1),
  }),
  z.object({
    ...commandBase,
    type: z.literal('skip'),
    turnId: z.number().int().positive(),
    cardWord: z.string().min(1),
  }),
  z.object({
    ...commandBase,
    type: z.literal('end-turn'),
    turnId: z.number().int().positive(),
  }),
  z.object({ ...commandBase, type: z.literal('next-round') }),
  z.object({ ...commandBase, type: z.literal('replay') }),
  z.object({ ...commandBase, type: z.literal('return-lobby') }),
  z.object({ ...commandBase, type: z.literal('end-session') }),
]);

export const commandEnvelopeSchema = z.object({
  actorId: z.string().min(1),
  receivedAt: z.number().finite().nonnegative(),
  command: sessionCommandSchema,
});

const projectionBase = {
  sessionId: z.string().min(1),
  mode: sessionModeSchema,
  recipientId: z.string().min(1).nullable(),
  isController: z.boolean(),
  version: z.number().int().nonnegative(),
  serverTime: z.number().finite().nonnegative(),
};

const scoreRoundsPointsSchema = z.object({
  1: z.number().nonnegative().optional(),
  2: z.number().nonnegative().optional(),
  3: z.number().nonnegative().optional(),
});
const scorePointsSchema = z.object({
  team1: z.object({
    total: z.number().nonnegative(),
    rounds: scoreRoundsPointsSchema,
  }),
  team2: z.object({
    total: z.number().nonnegative(),
    rounds: scoreRoundsPointsSchema,
  }),
});
const scoreRoundsCardsSchema = z.object({
  1: z.array(cardSchema).optional(),
  2: z.array(cardSchema).optional(),
  3: z.array(cardSchema).optional(),
});
const scoresByRoundSchema = z.object({
  team1: scoreRoundsCardsSchema,
  team2: scoreRoundsCardsSchema,
});

const pendingProjectionSchema = z.object({
  ...projectionBase,
  phase: z.literal('pending'),
  canActivate: z.boolean(),
});
const setupProjectionSchema = z.object({
  ...projectionBase,
  mode: z.literal('single-device'),
  phase: z.literal('setup'),
  configuration: sessionConfigurationSchema,
  canManage: z.boolean(),
});
const lobbyProjectionSchema = z.object({
  ...projectionBase,
  mode: z.literal('own-device'),
  phase: z.literal('lobby'),
  configuration: sessionConfigurationSchema,
  joinCode: z.string(),
  controllerId: z.string().min(1),
  participants: z.array(participantProjectionSchema),
  teamOrder: z.object({
    team1: z.array(z.string().min(1)),
    team2: z.array(z.string().min(1)),
  }),
  canManage: z.boolean(),
  roomReady: z.boolean(),
  canStart: z.boolean(),
});
const selectionProjectionSchema = z.object({
  ...projectionBase,
  phase: z.literal('selection'),
  selectionId: z.number().int().positive(),
  configuration: sessionConfigurationSchema,
  statuses: z.array(
    z.object({
      participantId: z.string().min(1),
      displayName: z.string().min(1),
      status: z.enum(['selecting', 'done']),
    })
  ),
  currentPlayer: z.number().int().positive().optional(),
  offer: z.array(cardSchema).optional(),
  draft: z.array(cardSchema).optional(),
  confirmed: z.boolean(),
  blockedParticipantIds: z.array(z.string().min(1)),
  canReveal: z.boolean().optional(),
  canEdit: z.boolean(),
  canCancel: z.boolean(),
});
const turnProjectionSchema = z.object({
  ...projectionBase,
  phase: z.literal('turn'),
  round: roundNumberSchema,
  currentTeam: teamIdSchema,
  clueGiverId: z.string().nullable(),
  clueGiverName: z.string().nullable(),
  turnId: z.number().int().positive(),
  turnActive: z.boolean(),
  turnEndsAt: z.number().finite().nonnegative().nullable(),
  clueGiverWaitEndsAt: z.number().finite().nonnegative().nullable(),
  initialCardCount: z.number().int().nonnegative(),
  remainingCardCount: z.number().int().nonnegative(),
  guessedCardCount: z.number().int().nonnegative(),
  scores: scorePointsSchema,
  card: cardSchema.optional(),
  controls: z
    .object({
      canStart: z.boolean(),
      canMarkCorrect: z.boolean(),
      canSkip: z.boolean(),
      canEnd: z.boolean(),
    })
    .optional(),
});
const roundScoreProjectionSchema = z.object({
  ...projectionBase,
  phase: z.literal('round-score'),
  round: roundNumberSchema,
  scores: scoresByRoundSchema,
  canContinue: z.boolean(),
});
const finalScoreProjectionSchema = z.object({
  ...projectionBase,
  phase: z.literal('final-score'),
  round: roundNumberSchema,
  scores: scoresByRoundSchema,
  canContinue: z.boolean(),
});
const endedProjectionSchema = z.object({
  ...projectionBase,
  phase: z.literal('ended'),
});

export const sessionProjectionSchema = z.discriminatedUnion('phase', [
  pendingProjectionSchema,
  setupProjectionSchema,
  lobbyProjectionSchema,
  selectionProjectionSchema,
  turnProjectionSchema,
  roundScoreProjectionSchema,
  finalScoreProjectionSchema,
  endedProjectionSchema,
]);

export const commandErrorCodeSchema = z.enum([
  'INVALID_COMMAND',
  'RATE_LIMITED',
  'SESSION_ENDED',
  'NOT_AUTHORIZED',
  'INVALID_PHASE',
  'STALE_REVISION',
  'STALE_SELECTION',
  'STALE_TURN',
  'INVALID_CONFIGURATION',
  'INVALID_NAME',
  'NAME_TAKEN',
  'PLAYER_NOT_FOUND',
  'PLAYER_DEPARTED',
  'PLAYER_DISCONNECTED',
  'ROOM_NOT_READY',
  'TEAM_UNAVAILABLE',
  'CARD_NOT_OFFERED',
  'CARD_COUNT_INVALID',
  'SELECTION_CONFIRMED',
  'TURN_NOT_ACTIVE',
  'CARD_MISMATCH',
  'SKIP_UNAVAILABLE',
  'CORRECT_COOLDOWN',
]);

export const commandAcknowledgementSchema = z.discriminatedUnion('ok', [
  z.object({
    type: z.literal('command-ack'),
    commandId: commandIdSchema,
    ok: z.literal(true),
    revision: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('command-ack'),
    commandId: commandIdSchema,
    ok: z.literal(false),
    revision: z.number().int().nonnegative(),
    error: z.object({
      code: commandErrorCodeSchema,
      message: z.string().min(1),
    }),
  }),
]);

export const serverEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('sound'),
    sound: z.enum(['bell', 'ring']),
    recipientId: z.string().min(1),
  }),
  z.object({
    type: z.literal('code-rotation-requested'),
    requestedBy: z.string().min(1),
  }),
  z.object({ type: z.literal('session-ended') }),
]);

export const serverMessageSchema = z.union([
  z.object({
    type: z.literal('projection'),
    projection: sessionProjectionSchema,
  }),
  commandAcknowledgementSchema,
  z.object({ type: z.literal('event'), event: serverEventSchema }),
]);
