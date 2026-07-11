import {
  getSelectionOptions,
  rotateTopCardToBack,
  shuffleCards,
  uniqueCardsByWord,
} from '@/features/game/cards/deck';
import type { Card, TeamId } from '@/features/game/domain/game-types';
import { getNextRound } from '@/features/game/domain/rounds';
import { addCardsToScore } from '@/features/game/domain/scoring';
import type {
  CommandAcknowledgement,
  CommandEnvelope,
  CommandError,
  CommandErrorCode,
  ServerEvent,
  SessionCommand,
} from '@/features/game/session-protocol/types';
import {
  CLUE_GIVER_GRACE_MS,
  CONTROLLER_GRACE_MS,
  CORRECT_COOLDOWN_MS,
  TURN_DURATION_MS,
  createFreshGameState,
  defaultRandom,
  normalizeDisplayName,
  validateDisplayName,
  type OwnDeviceParticipantState,
  type OwnDeviceSessionState,
  type SessionDependencies,
  type SessionState,
  type SessionTurnState,
  type SingleDeviceSessionState,
} from './session-state';

export interface SessionLifecycleTransition {
  state: SessionState;
  events: ServerEvent[];
}

export interface SessionCommandTransition extends SessionLifecycleTransition {
  acknowledgement: CommandAcknowledgement;
}

interface CommandMutation {
  state: SessionState;
  events?: ServerEvent[];
  error?: CommandError;
}

function error(
  state: SessionState,
  code: CommandErrorCode,
  message: string
): CommandMutation {
  return { state, error: { code, message } };
}

function otherTeam(team: TeamId): TeamId {
  return team === 'team1' ? 'team2' : 'team1';
}

function isController(state: SessionState, actorId: string): boolean {
  return state.controllerId === actorId;
}

function activeParticipants(
  state: OwnDeviceSessionState
): OwnDeviceParticipantState[] {
  return Object.values(state.participants).filter(
    (participant) => participant.departureStatus === 'active'
  );
}

function getActiveParticipant(
  state: OwnDeviceSessionState,
  participantId: string
): OwnDeviceParticipantState | null {
  const participant = state.participants[participantId];
  return participant?.departureStatus === 'active' ? participant : null;
}

function requireConnectedActor(
  state: SessionState,
  actorId: string
): CommandError | null {
  if (state.mode === 'single-device') {
    return isController(state, actorId)
      ? null
      : {
          code: 'NOT_AUTHORIZED',
          message: 'Perangkat ini tidak dapat mengendalikan sesi.',
        };
  }

  const participant = getActiveParticipant(state, actorId);
  if (!participant) {
    return {
      code: 'PLAYER_DEPARTED',
      message: 'Keanggotaan pemain ini sudah tidak berlaku.',
    };
  }
  if (!participant.connected) {
    return {
      code: 'PLAYER_DISCONNECTED',
      message: 'Sambungkan kembali perangkat sebelum melanjutkan.',
    };
  }
  return null;
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

function comparableName(displayName: string): string {
  return normalizeDisplayName(displayName).toLocaleLowerCase('id-ID');
}

function nameAlreadyUsed(
  state: OwnDeviceSessionState,
  displayName: string,
  exceptParticipantId: string
): boolean {
  const name = comparableName(displayName);
  return activeParticipants(state).some(
    (participant) =>
      participant.id !== exceptParticipantId &&
      comparableName(participant.displayName) === name
  );
}

export function isOwnDeviceLobbyReady(state: OwnDeviceSessionState): boolean {
  if (state.phase !== 'lobby') return false;
  const participants = activeParticipants(state);
  const team1Size = state.teamOrder.team1.filter(
    (id) => state.participants[id]?.departureStatus === 'active'
  ).length;
  const team2Size = state.teamOrder.team2.filter(
    (id) => state.participants[id]?.departureStatus === 'active'
  ).length;

  return (
    participants.length >= 2 &&
    participants.length <= 20 &&
    team1Size > 0 &&
    team2Size > 0 &&
    Math.abs(team1Size - team2Size) <= 1 &&
    participants.every(
      (participant) => participant.connected && participant.ready
    )
  );
}

function chooseReplacementController(
  state: OwnDeviceSessionState,
  excludedId?: string
): OwnDeviceParticipantState | null {
  const candidates = activeParticipants(state).filter(
    (participant) => participant.id !== excludedId && participant.connected
  );
  candidates.sort((first, second) => {
    const firstConnectedAt = first.connectedAt ?? Number.POSITIVE_INFINITY;
    const secondConnectedAt = second.connectedAt ?? Number.POSITIVE_INFINITY;
    return (
      firstConnectedAt - secondConnectedAt || first.joinOrder - second.joinOrder
    );
  });
  return candidates[0] ?? null;
}

function ownTeamOrder(state: OwnDeviceSessionState, team: TeamId): string[] {
  return (state.frozenTeamOrder ?? state.teamOrder)[team];
}

interface ScheduledClueGiver {
  clueGiverId: string | null;
  waitEndsAt: number | null;
  cursor: number;
}

function findScheduledClueGiver(
  state: OwnDeviceSessionState,
  team: TeamId,
  now: number,
  startCursor = state.clueGiverCursors[team],
  allowDisconnectedGrace = true
): ScheduledClueGiver {
  const order = ownTeamOrder(state, team);
  if (order.length === 0) {
    return { clueGiverId: null, waitEndsAt: null, cursor: 0 };
  }

  const connectedPlayerExists = order.some(
    (id) =>
      state.participants[id]?.departureStatus === 'active' &&
      state.participants[id]?.connected
  );
  if (!connectedPlayerExists) {
    return {
      clueGiverId: null,
      waitEndsAt: null,
      cursor: startCursor % order.length,
    };
  }

  for (let offset = 0; offset < order.length; offset += 1) {
    const cursor = (startCursor + offset) % order.length;
    const participant = state.participants[order[cursor]];
    if (!participant || participant.departureStatus === 'departed') continue;

    if (participant.connected) {
      return { clueGiverId: participant.id, waitEndsAt: null, cursor };
    }

    if (allowDisconnectedGrace) {
      const waitEndsAt =
        (participant.disconnectedAt ?? now) + CLUE_GIVER_GRACE_MS;
      if (now < waitEndsAt) {
        return { clueGiverId: participant.id, waitEndsAt, cursor };
      }
    }
  }

  return {
    clueGiverId: null,
    waitEndsAt: null,
    cursor: startCursor % order.length,
  };
}

function createHandoff(
  state: SessionState,
  team: TeamId,
  now: number
): SessionState {
  const turnId = state.game.turnSequence + 1;

  if (state.mode === 'single-device') {
    return {
      ...state,
      phase: 'turn',
      game: {
        ...state.game,
        turnSequence: turnId,
        turn: {
          id: turnId,
          currentTeam: team,
          clueGiverId: state.controllerId,
          clueGiverWaitEndsAt: null,
          active: false,
          startedAt: null,
          endsAt: null,
          guessedCards: [],
          canSkip: true,
          lastCorrectAt: null,
        },
      },
    };
  }

  const scheduled = findScheduledClueGiver(state, team, now);
  return {
    ...state,
    phase: 'turn',
    clueGiverCursors: {
      ...state.clueGiverCursors,
      [team]: scheduled.cursor,
    },
    game: {
      ...state.game,
      turnSequence: turnId,
      turn: {
        id: turnId,
        currentTeam: team,
        clueGiverId: scheduled.clueGiverId,
        clueGiverWaitEndsAt: scheduled.waitEndsAt,
        active: false,
        startedAt: null,
        endsAt: null,
        guessedCards: [],
        canSkip: true,
        lastCorrectAt: null,
      },
    },
  };
}

function advanceClueGiverCursor(
  state: OwnDeviceSessionState,
  turn: SessionTurnState
): OwnDeviceSessionState {
  const order = ownTeamOrder(state, turn.currentTeam);
  if (order.length === 0 || !turn.clueGiverId) return state;
  const index = order.indexOf(turn.clueGiverId);
  if (index < 0) return state;

  return {
    ...state,
    clueGiverCursors: {
      ...state.clueGiverCursors,
      [turn.currentTeam]: (index + 1) % order.length,
    },
  };
}

function finishTurn(
  state: SessionState,
  remainingCards: Card[],
  guessedCards: Card[],
  now: number
): SessionState {
  const turn = state.game.turn;
  if (!turn) return state;

  let nextState: SessionState = state;
  if (nextState.mode === 'own-device') {
    nextState = advanceClueGiverCursor(nextState, turn);
  }

  const scores = addCardsToScore(
    nextState.game.scores,
    turn.currentTeam,
    nextState.game.round,
    guessedCards
  );

  if (remainingCards.length === 0) {
    return {
      ...nextState,
      phase: nextState.game.round === 3 ? 'final-score' : 'round-score',
      game: {
        ...nextState.game,
        scores,
        remainingCards: [],
        turn: null,
      },
    };
  }

  nextState = {
    ...nextState,
    game: {
      ...nextState.game,
      scores,
      remainingCards,
      turn: null,
    },
  };
  return createHandoff(nextState, otherTeam(turn.currentTeam), now);
}

function startOwnSelection(
  state: OwnDeviceSessionState,
  dependencies: SessionDependencies
): CommandMutation {
  if (!isOwnDeviceLobbyReady(state)) {
    return error(
      state,
      'ROOM_NOT_READY',
      'Pastikan kedua tim seimbang dan semua pemain siap serta terhubung.'
    );
  }

  const participantIds = activeParticipants(state)
    .sort((first, second) => first.joinOrder - second.joinOrder)
    .map((participant) => participant.id);
  const optionCount = state.configuration.cardsPerPlayer + 2;
  const catalog = shuffleCards(
    uniqueCardsByWord(dependencies.catalog),
    dependencies.random ?? defaultRandom
  );
  if (catalog.length < participantIds.length * optionCount) {
    return error(
      state,
      'INVALID_CONFIGURATION',
      'Kartu yang tersedia tidak cukup untuk semua pemain.'
    );
  }

  const selectionId = state.game.selectionSequence + 1;
  const offers: Record<string, Card[]> = {};
  const drafts: Record<string, Card[]> = {};
  participantIds.forEach((participantId, index) => {
    offers[participantId] = catalog.slice(
      index * optionCount,
      (index + 1) * optionCount
    );
    drafts[participantId] = [];
  });

  return {
    state: {
      ...state,
      phase: 'selection',
      frozenTeamOrder: {
        team1: state.teamOrder.team1.filter((id) =>
          participantIds.includes(id)
        ),
        team2: state.teamOrder.team2.filter((id) =>
          participantIds.includes(id)
        ),
      },
      selection: {
        id: selectionId,
        participantIds,
        offers,
        drafts,
        confirmedParticipantIds: [],
      },
      game: {
        ...createFreshGameState(state, { preserveSequences: true }),
        selectionSequence: selectionId,
      },
    },
  };
}

function startSingleSelection(
  state: SingleDeviceSessionState,
  dependencies: SessionDependencies
): CommandMutation {
  const requiredCards =
    state.configuration.players * state.configuration.cardsPerPlayer + 2;
  const catalog = uniqueCardsByWord(dependencies.catalog);
  if (catalog.length < requiredCards) {
    return error(
      state,
      'INVALID_CONFIGURATION',
      'Kartu yang tersedia tidak cukup untuk jumlah pemain ini.'
    );
  }

  const selectionId = state.game.selectionSequence + 1;
  return {
    state: {
      ...state,
      phase: 'selection',
      selection: {
        id: selectionId,
        currentPlayer: 1,
        offer: getSelectionOptions(
          catalog,
          [],
          state.configuration.cardsPerPlayer,
          dependencies.random ?? defaultRandom
        ),
        draft: [],
        revealed: false,
      },
      game: {
        ...createFreshGameState(state, { preserveSequences: true }),
        selectionSequence: selectionId,
      },
    },
  };
}

function updateSetup(
  state: SessionState,
  actorId: string,
  command: Extract<SessionCommand, { type: 'update-setup' }>
): CommandMutation {
  if (!isController(state, actorId)) {
    return error(
      state,
      'NOT_AUTHORIZED',
      'Hanya pengendali sesi yang dapat mengubah pengaturan.'
    );
  }
  if (
    (state.mode === 'single-device' && state.phase !== 'setup') ||
    (state.mode === 'own-device' && state.phase !== 'lobby')
  ) {
    return error(
      state,
      'INVALID_PHASE',
      'Pengaturan tidak dapat diubah pada tahap ini.'
    );
  }
  if (command.players === undefined && command.cardsPerPlayer === undefined) {
    return error(state, 'INVALID_COMMAND', 'Tidak ada pengaturan yang diubah.');
  }
  if (
    command.cardsPerPlayer !== undefined &&
    (!Number.isInteger(command.cardsPerPlayer) ||
      command.cardsPerPlayer < 1 ||
      command.cardsPerPlayer > 10)
  ) {
    return error(
      state,
      'INVALID_CONFIGURATION',
      'Jumlah kartu per pemain harus antara 1 dan 10.'
    );
  }

  if (state.mode === 'own-device') {
    if (
      command.players !== undefined &&
      command.players !== activeParticipants(state).length
    ) {
      return error(
        state,
        'INVALID_CONFIGURATION',
        'Jumlah pemain ditentukan oleh anggota yang berada di lobi.'
      );
    }
    if (
      command.cardsPerPlayer === undefined ||
      command.cardsPerPlayer === state.configuration.cardsPerPlayer
    ) {
      return { state };
    }
    return {
      state: {
        ...state,
        configuration: {
          players: activeParticipants(state).length,
          cardsPerPlayer: command.cardsPerPlayer,
        },
        participants: resetAllReadiness(state.participants),
      },
    };
  }

  const players = command.players ?? state.configuration.players;
  if (!Number.isInteger(players) || players < 2 || players > 20) {
    return error(
      state,
      'INVALID_CONFIGURATION',
      'Jumlah pemain harus antara 2 dan 20.'
    );
  }
  const configuration = {
    players,
    cardsPerPlayer:
      command.cardsPerPlayer ?? state.configuration.cardsPerPlayer,
  };
  if (
    configuration.players === state.configuration.players &&
    configuration.cardsPerPlayer === state.configuration.cardsPerPlayer
  ) {
    return { state };
  }
  return { state: { ...state, configuration } };
}

function setReady(
  state: SessionState,
  actorId: string,
  ready: boolean
): CommandMutation {
  if (state.mode !== 'own-device' || state.phase !== 'lobby') {
    return error(
      state,
      'INVALID_PHASE',
      'Status siap hanya dapat diubah di lobi.'
    );
  }
  const participant = getActiveParticipant(state, actorId);
  if (!participant) {
    return error(
      state,
      'PLAYER_DEPARTED',
      'Keanggotaan pemain ini sudah tidak berlaku.'
    );
  }
  if (!participant.connected) {
    return error(
      state,
      'PLAYER_DISCONNECTED',
      'Sambungkan kembali perangkat sebelum menyatakan siap.'
    );
  }
  if (participant.ready === ready) return { state };
  return {
    state: {
      ...state,
      participants: {
        ...state.participants,
        [actorId]: { ...participant, ready },
      },
    },
  };
}

function renamePlayer(
  state: SessionState,
  actorId: string,
  displayName: string
): CommandMutation {
  if (state.mode !== 'own-device' || state.phase !== 'lobby') {
    return error(state, 'INVALID_PHASE', 'Nama hanya dapat diubah di lobi.');
  }
  const participant = getActiveParticipant(state, actorId);
  if (!participant) {
    return error(
      state,
      'PLAYER_DEPARTED',
      'Keanggotaan pemain ini sudah tidak berlaku.'
    );
  }
  const validationError = validateDisplayName(displayName);
  if (validationError) return { state, error: validationError };
  if (nameAlreadyUsed(state, displayName, actorId)) {
    return error(
      state,
      'NAME_TAKEN',
      'Nama tersebut sudah digunakan di sesi ini.'
    );
  }
  const normalizedName = normalizeDisplayName(displayName);
  if (participant.displayName === normalizedName) return { state };

  return {
    state: {
      ...state,
      participants: {
        ...state.participants,
        [actorId]: {
          ...participant,
          displayName: normalizedName,
          ready: false,
        },
      },
    },
  };
}

function movePlayer(
  state: SessionState,
  actorId: string,
  playerId: string,
  team: TeamId
): CommandMutation {
  if (state.mode !== 'own-device' || state.phase !== 'lobby') {
    return error(
      state,
      'INVALID_PHASE',
      'Susunan tim hanya dapat diubah di lobi.'
    );
  }
  if (!isController(state, actorId)) {
    return error(
      state,
      'NOT_AUTHORIZED',
      'Hanya pengendali sesi yang dapat memindahkan pemain.'
    );
  }
  const participant = getActiveParticipant(state, playerId);
  if (!participant) {
    return error(state, 'PLAYER_NOT_FOUND', 'Pemain tidak ditemukan.');
  }
  if (participant.team === team) return { state };

  return {
    state: {
      ...state,
      participants: {
        ...state.participants,
        [playerId]: { ...participant, team, ready: false },
      },
      teamOrder: {
        ...state.teamOrder,
        [participant.team]: state.teamOrder[participant.team].filter(
          (id) => id !== playerId
        ),
        [team]: [...state.teamOrder[team], playerId],
      },
    },
  };
}

function reorderPlayer(
  state: SessionState,
  actorId: string,
  playerId: string,
  direction: 'up' | 'down'
): CommandMutation {
  if (state.mode !== 'own-device' || state.phase !== 'lobby') {
    return error(
      state,
      'INVALID_PHASE',
      'Urutan pemain hanya dapat diubah di lobi.'
    );
  }
  if (!isController(state, actorId)) {
    return error(
      state,
      'NOT_AUTHORIZED',
      'Hanya pengendali sesi yang dapat mengubah urutan.'
    );
  }
  const participant = getActiveParticipant(state, playerId);
  if (!participant) {
    return error(state, 'PLAYER_NOT_FOUND', 'Pemain tidak ditemukan.');
  }

  const order = [...state.teamOrder[participant.team]];
  const index = order.indexOf(playerId);
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= order.length) return { state };
  const swappedPlayerId = order[swapIndex];
  [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  return {
    state: {
      ...state,
      participants: {
        ...state.participants,
        [playerId]: { ...participant, ready: false },
        [swappedPlayerId]: {
          ...state.participants[swappedPlayerId],
          ready: false,
        },
      },
      teamOrder: { ...state.teamOrder, [participant.team]: order },
    },
  };
}

function removePlayer(
  state: SessionState,
  actorId: string,
  playerId: string
): CommandMutation {
  if (state.mode !== 'own-device' || state.phase !== 'lobby') {
    return error(
      state,
      'INVALID_PHASE',
      'Pemain hanya dapat dikeluarkan dari lobi.'
    );
  }
  if (!isController(state, actorId)) {
    return error(
      state,
      'NOT_AUTHORIZED',
      'Hanya pengendali sesi yang dapat mengeluarkan pemain.'
    );
  }
  const participant = getActiveParticipant(state, playerId);
  if (!participant) {
    return error(state, 'PLAYER_NOT_FOUND', 'Pemain tidak ditemukan.');
  }
  if (activeParticipants(state).length === 1) {
    return error(
      state,
      'INVALID_CONFIGURATION',
      'Akhiri sesi untuk mengeluarkan pemain terakhir.'
    );
  }

  const participants = { ...state.participants };
  delete participants[playerId];
  const readinessReset = resetAllReadiness(participants);
  const teamOrder = {
    team1: state.teamOrder.team1.filter((id) => id !== playerId),
    team2: state.teamOrder.team2.filter((id) => id !== playerId),
  };
  let controllerId = state.controllerId;
  if (playerId === state.controllerId) {
    const replacementState = { ...state, participants };
    controllerId =
      chooseReplacementController(replacementState, playerId)?.id ??
      activeParticipants(replacementState).sort(
        (first, second) => first.joinOrder - second.joinOrder
      )[0].id;
  }

  return {
    state: {
      ...state,
      controllerId,
      participants: readinessReset,
      teamOrder,
      configuration: {
        ...state.configuration,
        players: activeParticipants(state).length - 1,
      },
    },
  };
}

function startSelection(
  state: SessionState,
  actorId: string,
  dependencies: SessionDependencies
): CommandMutation {
  if (!isController(state, actorId)) {
    return error(
      state,
      'NOT_AUTHORIZED',
      'Hanya pengendali sesi yang dapat memulai permainan.'
    );
  }
  if (state.mode === 'single-device') {
    if (state.phase !== 'setup') {
      return error(
        state,
        'INVALID_PHASE',
        'Pemilihan kartu tidak dapat dimulai pada tahap ini.'
      );
    }
    return startSingleSelection(state, dependencies);
  }
  if (state.phase !== 'lobby') {
    return error(
      state,
      'INVALID_PHASE',
      'Pemilihan kartu tidak dapat dimulai pada tahap ini.'
    );
  }
  return startOwnSelection(state, dependencies);
}

function verifySelection(
  state: SessionState,
  selectionId: number
): CommandError | null {
  if (state.phase !== 'selection' || !state.selection) {
    return {
      code: 'INVALID_PHASE',
      message: 'Pemilihan kartu sudah tidak aktif.',
    };
  }
  if (state.selection.id !== selectionId) {
    return {
      code: 'STALE_SELECTION',
      message: 'Pemilihan kartu ini sudah tidak berlaku.',
    };
  }
  return null;
}

function revealSingleOffer(
  state: SessionState,
  actorId: string,
  selectionId: number
): CommandMutation {
  const selectionError = verifySelection(state, selectionId);
  if (selectionError) return { state, error: selectionError };
  if (state.mode !== 'single-device' || !state.selection) {
    return error(
      state,
      'INVALID_COMMAND',
      'Aksi serah-terima ini hanya berlaku untuk satu perangkat.'
    );
  }
  if (!isController(state, actorId)) {
    return error(
      state,
      'NOT_AUTHORIZED',
      'Perangkat ini tidak dapat membuka pilihan kartu.'
    );
  }
  if (state.selection.revealed) return { state };
  return {
    state: {
      ...state,
      selection: { ...state.selection, revealed: true },
    },
  };
}

function toggleCard(
  state: SessionState,
  actorId: string,
  selectionId: number,
  cardWord: string
): CommandMutation {
  const selectionError = verifySelection(state, selectionId);
  if (selectionError) return { state, error: selectionError };
  if (!state.selection) return { state };

  if (state.mode === 'single-device') {
    if (!isController(state, actorId)) {
      return error(
        state,
        'NOT_AUTHORIZED',
        'Perangkat ini tidak dapat memilih kartu.'
      );
    }
    if (!state.selection.revealed) {
      return error(
        state,
        'NOT_AUTHORIZED',
        'Selesaikan serah-terima sebelum memilih kartu.'
      );
    }
    const card = state.selection.offer.find(
      (offeredCard) => offeredCard.word === cardWord
    );
    if (!card) {
      return error(
        state,
        'CARD_NOT_OFFERED',
        'Kartu tersebut tidak termasuk dalam pilihan pemain ini.'
      );
    }
    const selected = state.selection.draft.some(
      (draftCard) => draftCard.word === cardWord
    );
    const draft = selected
      ? state.selection.draft.filter((draftCard) => draftCard.word !== cardWord)
      : state.selection.draft.length < state.configuration.cardsPerPlayer
        ? [...state.selection.draft, card]
        : state.selection.draft;
    if (draft === state.selection.draft) return { state };
    return { state: { ...state, selection: { ...state.selection, draft } } };
  }

  if (state.selection.confirmedParticipantIds.includes(actorId)) {
    return error(
      state,
      'SELECTION_CONFIRMED',
      'Pilihan kartu yang sudah dikonfirmasi tidak dapat diubah.'
    );
  }
  const offer = state.selection.offers[actorId];
  const draft = state.selection.drafts[actorId];
  if (!offer || !draft) {
    return error(
      state,
      'NOT_AUTHORIZED',
      'Pemain ini tidak memiliki pilihan kartu.'
    );
  }
  const card = offer.find((offeredCard) => offeredCard.word === cardWord);
  if (!card) {
    return error(
      state,
      'CARD_NOT_OFFERED',
      'Kartu tersebut tidak termasuk dalam pilihanmu.'
    );
  }
  const selected = draft.some((draftCard) => draftCard.word === cardWord);
  const nextDraft = selected
    ? draft.filter((draftCard) => draftCard.word !== cardWord)
    : draft.length < state.configuration.cardsPerPlayer
      ? [...draft, card]
      : draft;
  if (nextDraft === draft) return { state };
  return {
    state: {
      ...state,
      selection: {
        ...state.selection,
        drafts: { ...state.selection.drafts, [actorId]: nextDraft },
      },
    },
  };
}

function completeSelection(
  state: SessionState,
  chosenDeck: Card[],
  now: number,
  dependencies: SessionDependencies
): SessionState {
  let nextState: SessionState = {
    ...state,
    phase: 'turn',
    selection: null,
    game: {
      ...state.game,
      chosenDeck,
      round: 1,
      remainingCards: shuffleCards(
        chosenDeck,
        dependencies.random ?? defaultRandom
      ),
      turn: null,
    },
  };
  nextState = createHandoff(nextState, 'team1', now);
  return nextState;
}

function confirmSelection(
  state: SessionState,
  actorId: string,
  selectionId: number,
  now: number,
  dependencies: SessionDependencies
): CommandMutation {
  const selectionError = verifySelection(state, selectionId);
  if (selectionError) return { state, error: selectionError };
  if (!state.selection) return { state };

  if (state.mode === 'single-device') {
    if (!isController(state, actorId) || !state.selection.revealed) {
      return error(
        state,
        'NOT_AUTHORIZED',
        'Selesaikan serah-terima sebelum mengonfirmasi kartu.'
      );
    }
    if (state.selection.draft.length !== state.configuration.cardsPerPlayer) {
      return error(
        state,
        'CARD_COUNT_INVALID',
        `Pilih tepat ${state.configuration.cardsPerPlayer} kartu.`
      );
    }
    const chosenDeck = [...state.game.chosenDeck, ...state.selection.draft];
    if (state.selection.currentPlayer === state.configuration.players) {
      return {
        state: completeSelection(state, chosenDeck, now, dependencies),
      };
    }

    return {
      state: {
        ...state,
        selection: {
          ...state.selection,
          currentPlayer: state.selection.currentPlayer + 1,
          offer: getSelectionOptions(
            dependencies.catalog,
            chosenDeck,
            state.configuration.cardsPerPlayer,
            dependencies.random ?? defaultRandom
          ),
          draft: [],
          revealed: false,
        },
        game: { ...state.game, chosenDeck },
      },
    };
  }

  if (state.selection.confirmedParticipantIds.includes(actorId)) {
    return error(
      state,
      'SELECTION_CONFIRMED',
      'Pilihan kartu ini sudah dikonfirmasi.'
    );
  }
  const draft = state.selection.drafts[actorId];
  if (!draft) {
    return error(
      state,
      'NOT_AUTHORIZED',
      'Pemain ini tidak memiliki pilihan kartu.'
    );
  }
  if (draft.length !== state.configuration.cardsPerPlayer) {
    return error(
      state,
      'CARD_COUNT_INVALID',
      `Pilih tepat ${state.configuration.cardsPerPlayer} kartu.`
    );
  }

  const confirmedParticipantIds = [
    ...state.selection.confirmedParticipantIds,
    actorId,
  ];
  if (
    confirmedParticipantIds.length === state.selection.participantIds.length
  ) {
    const chosenDeck = state.selection.participantIds.flatMap(
      (participantId) => state.selection?.drafts[participantId] ?? []
    );
    return {
      state: completeSelection(state, chosenDeck, now, dependencies),
    };
  }
  return {
    state: {
      ...state,
      selection: { ...state.selection, confirmedParticipantIds },
    },
  };
}

function cleanLobbyState(state: OwnDeviceSessionState): OwnDeviceSessionState {
  const participants = Object.fromEntries(
    Object.entries(state.participants)
      .filter(([, participant]) => participant.departureStatus === 'active')
      .map(([id, participant]) => [id, { ...participant, ready: false }])
  );
  const teamOrder = {
    team1: state.teamOrder.team1.filter((id) => participants[id]),
    team2: state.teamOrder.team2.filter((id) => participants[id]),
  };
  const controller = participants[state.controllerId]
    ? state.controllerId
    : (chooseReplacementController({ ...state, participants })?.id ??
      Object.values(participants).sort(
        (first, second) => first.joinOrder - second.joinOrder
      )[0]?.id ??
      state.controllerId);

  return {
    ...state,
    phase: 'lobby',
    controllerId: controller,
    participants,
    teamOrder,
    frozenTeamOrder: null,
    clueGiverCursors: { team1: 0, team2: 0 },
    selection: null,
    configuration: {
      ...state.configuration,
      players: Object.keys(participants).length,
    },
    game: createFreshGameState(state, { preserveSequences: true }),
  };
}

function cancelSelection(
  state: SessionState,
  actorId: string,
  selectionId: number
): CommandMutation {
  const selectionError = verifySelection(state, selectionId);
  if (selectionError) return { state, error: selectionError };
  if (!isController(state, actorId)) {
    return error(
      state,
      'NOT_AUTHORIZED',
      'Hanya pengendali sesi yang dapat membatalkan pemilihan.'
    );
  }
  if (state.mode === 'single-device') {
    return {
      state: {
        ...state,
        phase: 'setup',
        selection: null,
        game: createFreshGameState(state, { preserveSequences: true }),
      },
    };
  }
  const selection = state.selection;
  if (!selection) {
    return error(state, 'INVALID_PHASE', 'Pemilihan kartu sudah tidak aktif.');
  }
  const selectionIsBlocked = selection.participantIds.some(
    (participantId) =>
      !selection.confirmedParticipantIds.includes(participantId) &&
      (!state.participants[participantId] ||
        state.participants[participantId].departureStatus === 'departed')
  );
  if (!selectionIsBlocked) {
    return error(
      state,
      'INVALID_COMMAND',
      'Pemilihan hanya dapat dibatalkan setelah pemain yang belum selesai meninggalkan sesi.'
    );
  }
  return { state: cleanLobbyState(state) };
}

function verifyTurn(state: SessionState, turnId: number): CommandError | null {
  if (state.phase !== 'turn' || !state.game.turn) {
    return {
      code: 'INVALID_PHASE',
      message: 'Giliran ini sudah berakhir.',
    };
  }
  if (state.game.turn.id !== turnId) {
    return {
      code: 'STALE_TURN',
      message: 'Giliran ini sudah tidak berlaku.',
    };
  }
  return null;
}

function requireClueGiver(
  state: SessionState,
  actorId: string
): CommandError | null {
  if (state.game.turn?.clueGiverId !== actorId) {
    return {
      code: 'NOT_AUTHORIZED',
      message: 'Hanya pemberi petunjuk aktif yang dapat melakukan aksi ini.',
    };
  }
  if (state.mode === 'own-device') {
    const participant = getActiveParticipant(state, actorId);
    if (!participant?.connected) {
      return {
        code: 'PLAYER_DISCONNECTED',
        message: 'Sambungkan kembali perangkat sebelum melanjutkan.',
      };
    }
  }
  return null;
}

function startTurn(
  state: SessionState,
  actorId: string,
  turnId: number,
  now: number
): CommandMutation {
  const turnError = verifyTurn(state, turnId);
  if (turnError) return { state, error: turnError };
  const clueGiverError = requireClueGiver(state, actorId);
  if (clueGiverError) return { state, error: clueGiverError };
  const turn = state.game.turn;
  if (!turn) return { state };
  if (turn.active) {
    return error(state, 'TURN_NOT_ACTIVE', 'Giliran sudah dimulai.');
  }
  if (state.game.remainingCards.length === 0) {
    return error(state, 'TURN_NOT_ACTIVE', 'Tidak ada kartu tersisa.');
  }

  return {
    state: {
      ...state,
      game: {
        ...state.game,
        turn: {
          ...turn,
          active: true,
          startedAt: now,
          endsAt: now + TURN_DURATION_MS,
          canSkip: true,
          lastCorrectAt: null,
        },
      },
    },
  };
}

function correctCard(
  state: SessionState,
  actorId: string,
  turnId: number,
  cardWord: string,
  now: number
): CommandMutation {
  const turnError = verifyTurn(state, turnId);
  if (turnError) return { state, error: turnError };
  const clueGiverError = requireClueGiver(state, actorId);
  if (clueGiverError) return { state, error: clueGiverError };
  const turn = state.game.turn;
  if (!turn?.active) {
    return error(state, 'TURN_NOT_ACTIVE', 'Mulai giliran terlebih dahulu.');
  }
  const card = state.game.remainingCards[0];
  if (!card || card.word !== cardWord) {
    return error(
      state,
      'CARD_MISMATCH',
      'Kartu aktif sudah berubah. Periksa tampilan terbaru.'
    );
  }
  if (
    turn.lastCorrectAt !== null &&
    now - turn.lastCorrectAt < CORRECT_COOLDOWN_MS
  ) {
    return error(
      state,
      'CORRECT_COOLDOWN',
      'Tunggu sebentar sebelum menandai jawaban berikutnya.'
    );
  }

  const [, ...remainingCards] = state.game.remainingCards;
  const guessedCards = [...turn.guessedCards, card];
  const events: ServerEvent[] = [
    { type: 'sound', sound: 'bell', recipientId: actorId },
  ];
  if (remainingCards.length === 0) {
    events.push({ type: 'sound', sound: 'ring', recipientId: actorId });
    return {
      state: finishTurn(state, remainingCards, guessedCards, now),
      events,
    };
  }

  return {
    state: {
      ...state,
      game: {
        ...state.game,
        remainingCards,
        turn: {
          ...turn,
          guessedCards,
          canSkip: true,
          lastCorrectAt: now,
        },
      },
    },
    events,
  };
}

function skipCard(
  state: SessionState,
  actorId: string,
  turnId: number,
  cardWord: string
): CommandMutation {
  const turnError = verifyTurn(state, turnId);
  if (turnError) return { state, error: turnError };
  const clueGiverError = requireClueGiver(state, actorId);
  if (clueGiverError) return { state, error: clueGiverError };
  const turn = state.game.turn;
  if (!turn?.active) {
    return error(state, 'TURN_NOT_ACTIVE', 'Mulai giliran terlebih dahulu.');
  }
  if (state.game.remainingCards[0]?.word !== cardWord) {
    return error(
      state,
      'CARD_MISMATCH',
      'Kartu aktif sudah berubah. Periksa tampilan terbaru.'
    );
  }
  if (!turn.canSkip || state.game.remainingCards.length <= 1) {
    return error(
      state,
      'SKIP_UNAVAILABLE',
      'Kesempatan lewati belum tersedia.'
    );
  }

  return {
    state: {
      ...state,
      game: {
        ...state.game,
        remainingCards: rotateTopCardToBack(state.game.remainingCards),
        turn: { ...turn, canSkip: false },
      },
    },
  };
}

function endTurn(
  state: SessionState,
  actorId: string,
  turnId: number,
  now: number
): CommandMutation {
  const turnError = verifyTurn(state, turnId);
  if (turnError) return { state, error: turnError };
  const clueGiverError = requireClueGiver(state, actorId);
  if (clueGiverError) return { state, error: clueGiverError };
  const turn = state.game.turn;
  if (!turn?.active) {
    return error(state, 'TURN_NOT_ACTIVE', 'Giliran belum dimulai.');
  }
  return {
    state: finishTurn(state, state.game.remainingCards, turn.guessedCards, now),
    events: [{ type: 'sound', sound: 'ring', recipientId: actorId }],
  };
}

function nextRound(
  state: SessionState,
  actorId: string,
  now: number,
  dependencies: SessionDependencies
): CommandMutation {
  if (state.phase !== 'round-score') {
    return error(
      state,
      'INVALID_PHASE',
      'Ronde berikutnya belum dapat dimulai.'
    );
  }
  if (!isController(state, actorId)) {
    return error(
      state,
      'NOT_AUTHORIZED',
      'Hanya pengendali sesi yang dapat memulai ronde berikutnya.'
    );
  }
  const round = getNextRound(state.game.round);
  if (!round) {
    return error(state, 'INVALID_PHASE', 'Semua ronde sudah selesai.');
  }
  const remainingCards = shuffleCards(
    state.game.chosenDeck,
    dependencies.random ?? defaultRandom
  );
  const nextState: SessionState = {
    ...state,
    phase: 'turn',
    game: {
      ...state.game,
      round,
      remainingCards,
      turn: null,
    },
  };
  return { state: createHandoff(nextState, 'team1', now) };
}

function replay(state: SessionState, actorId: string): CommandMutation {
  if (state.phase !== 'final-score') {
    return error(
      state,
      'INVALID_PHASE',
      'Permainan belum mencapai skor akhir.'
    );
  }
  if (!isController(state, actorId)) {
    return error(
      state,
      'NOT_AUTHORIZED',
      'Hanya pengendali sesi yang dapat memulai permainan baru.'
    );
  }
  if (state.mode === 'single-device') {
    return {
      state: {
        ...state,
        phase: 'setup',
        configuration: { players: 4, cardsPerPlayer: 5 },
        selection: null,
        game: createFreshGameState(state, { preserveSequences: true }),
      },
    };
  }
  return { state: cleanLobbyState(state) };
}

function returnLobby(state: SessionState, actorId: string): CommandMutation {
  if (state.mode !== 'own-device' || state.phase === 'pending') {
    return error(
      state,
      'INVALID_PHASE',
      'Sesi ini tidak memiliki lobi bersama.'
    );
  }
  if (state.phase === 'lobby') return { state };
  if (state.phase === 'ended') {
    return error(state, 'SESSION_ENDED', 'Sesi ini sudah berakhir.');
  }
  if (!isController(state, actorId)) {
    return error(
      state,
      'NOT_AUTHORIZED',
      'Hanya pengendali sesi yang dapat kembali ke lobi.'
    );
  }
  return { state: cleanLobbyState(state) };
}

function dispatchCommand(
  state: SessionState,
  envelope: CommandEnvelope,
  dependencies: SessionDependencies
): CommandMutation {
  const { actorId, receivedAt: now, command } = envelope;

  switch (command.type) {
    case 'update-setup':
      return updateSetup(state, actorId, command);
    case 'set-ready':
      return setReady(state, actorId, command.ready);
    case 'rename-player':
      return renamePlayer(state, actorId, command.displayName);
    case 'move-player':
      return movePlayer(state, actorId, command.playerId, command.team);
    case 'reorder-player':
      return reorderPlayer(state, actorId, command.playerId, command.direction);
    case 'remove-player':
      return removePlayer(state, actorId, command.playerId);
    case 'rotate-code':
      if (
        state.mode !== 'own-device' ||
        state.phase !== 'lobby' ||
        !isController(state, actorId)
      ) {
        return error(
          state,
          'NOT_AUTHORIZED',
          'Hanya pengendali lobi yang dapat mengganti kode.'
        );
      }
      return {
        state,
        events: [{ type: 'code-rotation-requested', requestedBy: actorId }],
      };
    case 'start-selection':
      return startSelection(state, actorId, dependencies);
    case 'reveal-single-offer':
      return revealSingleOffer(state, actorId, command.selectionId);
    case 'toggle-card':
      return toggleCard(state, actorId, command.selectionId, command.cardWord);
    case 'confirm-selection':
      return confirmSelection(
        state,
        actorId,
        command.selectionId,
        now,
        dependencies
      );
    case 'cancel-selection':
      return cancelSelection(state, actorId, command.selectionId);
    case 'start-turn':
      return startTurn(state, actorId, command.turnId, now);
    case 'correct':
      return correctCard(state, actorId, command.turnId, command.cardWord, now);
    case 'skip':
      return skipCard(state, actorId, command.turnId, command.cardWord);
    case 'end-turn':
      return endTurn(state, actorId, command.turnId, now);
    case 'next-round':
      return nextRound(state, actorId, now, dependencies);
    case 'replay':
      return replay(state, actorId);
    case 'return-lobby':
      return returnLobby(state, actorId);
    case 'end-session':
      if (!isController(state, actorId)) {
        return error(
          state,
          'NOT_AUTHORIZED',
          'Hanya pengendali sesi yang dapat mengakhiri sesi.'
        );
      }
      return {
        state: { ...state, phase: 'ended' } as SessionState,
        events: [{ type: 'session-ended' }],
      };
  }
}

function reconcileWithoutRevision(
  state: SessionState,
  now: number
): SessionLifecycleTransition {
  let nextState = state;
  const events: ServerEvent[] = [];

  if (nextState.mode === 'own-device') {
    let participants = nextState.participants;
    let participantsChanged = false;
    for (const participant of activeParticipants(nextState)) {
      if (
        participant.ready &&
        !participant.connected &&
        participant.disconnectedAt !== null &&
        now >= participant.disconnectedAt + CONTROLLER_GRACE_MS
      ) {
        if (!participantsChanged) participants = { ...participants };
        participants[participant.id] = { ...participant, ready: false };
        participantsChanged = true;
      }
    }
    if (participantsChanged) nextState = { ...nextState, participants };

    const controller = getActiveParticipant(nextState, nextState.controllerId);
    if (
      !controller ||
      (!controller.connected &&
        controller.disconnectedAt !== null &&
        now >= controller.disconnectedAt + CONTROLLER_GRACE_MS)
    ) {
      const replacement = chooseReplacementController(nextState);
      if (replacement && replacement.id !== nextState.controllerId) {
        nextState = { ...nextState, controllerId: replacement.id };
      }
    }
  }

  const turn = nextState.game.turn;
  if (nextState.phase === 'turn' && turn) {
    if (turn.active && turn.endsAt !== null && now >= turn.endsAt) {
      const recipientId = turn.clueGiverId;
      nextState = finishTurn(
        nextState,
        rotateTopCardToBack(nextState.game.remainingCards),
        turn.guessedCards,
        now
      );
      if (recipientId) {
        events.push({ type: 'sound', sound: 'ring', recipientId });
      }
    } else if (!turn.active && nextState.mode === 'own-device') {
      const participant = turn.clueGiverId
        ? nextState.participants[turn.clueGiverId]
        : null;
      if (participant?.connected) {
        if (turn.clueGiverWaitEndsAt !== null) {
          nextState = {
            ...nextState,
            game: {
              ...nextState.game,
              turn: { ...turn, clueGiverWaitEndsAt: null },
            },
          };
        }
      } else {
        const shouldReschedule =
          !participant ||
          participant.departureStatus === 'departed' ||
          (turn.clueGiverWaitEndsAt !== null &&
            now >= turn.clueGiverWaitEndsAt) ||
          turn.clueGiverId === null;
        if (shouldReschedule) {
          const order = ownTeamOrder(nextState, turn.currentTeam);
          const currentIndex = turn.clueGiverId
            ? order.indexOf(turn.clueGiverId)
            : -1;
          const startCursor =
            currentIndex >= 0
              ? (currentIndex + 1) % Math.max(order.length, 1)
              : nextState.clueGiverCursors[turn.currentTeam];
          const scheduled = findScheduledClueGiver(
            nextState,
            turn.currentTeam,
            now,
            startCursor,
            false
          );
          if (
            scheduled.clueGiverId !== turn.clueGiverId ||
            scheduled.waitEndsAt !== turn.clueGiverWaitEndsAt
          ) {
            nextState = {
              ...nextState,
              clueGiverCursors: {
                ...nextState.clueGiverCursors,
                [turn.currentTeam]: scheduled.cursor,
              },
              game: {
                ...nextState.game,
                turn: {
                  ...turn,
                  clueGiverId: scheduled.clueGiverId,
                  clueGiverWaitEndsAt: scheduled.waitEndsAt,
                },
              },
            };
          }
        } else if (
          participant &&
          turn.clueGiverWaitEndsAt === null &&
          participant.disconnectedAt !== null
        ) {
          nextState = {
            ...nextState,
            game: {
              ...nextState.game,
              turn: {
                ...turn,
                clueGiverWaitEndsAt:
                  participant.disconnectedAt + CLUE_GIVER_GRACE_MS,
              },
            },
          };
        }
      }
    }
  }

  return { state: nextState, events };
}

export function reconcileSessionDeadlines(
  state: SessionState,
  now: number
): SessionLifecycleTransition {
  const transition = reconcileWithoutRevision(state, now);
  if (transition.state === state) return transition;
  return {
    ...transition,
    state: {
      ...transition.state,
      revision: state.revision + 1,
    } as SessionState,
  };
}

export function getNextSessionDeadline(
  state: SessionState,
  after = Date.now()
): number | null {
  const deadlines: number[] = [];
  const turn = state.game.turn;
  if (turn?.active && turn.endsAt !== null) deadlines.push(turn.endsAt);
  if (turn?.active && turn.lastCorrectAt !== null) {
    deadlines.push(turn.lastCorrectAt + CORRECT_COOLDOWN_MS);
  }
  if (turn && !turn.active && turn.clueGiverWaitEndsAt !== null) {
    deadlines.push(turn.clueGiverWaitEndsAt);
  }

  if (state.mode === 'own-device') {
    const controller = getActiveParticipant(state, state.controllerId);
    if (
      controller &&
      !controller.connected &&
      controller.disconnectedAt !== null
    ) {
      deadlines.push(controller.disconnectedAt + CONTROLLER_GRACE_MS);
    }
    for (const participant of activeParticipants(state)) {
      if (
        participant.ready &&
        !participant.connected &&
        participant.disconnectedAt !== null
      ) {
        deadlines.push(participant.disconnectedAt + CONTROLLER_GRACE_MS);
      }
    }
  }

  const futureDeadlines = deadlines.filter((deadline) => deadline > after);
  return futureDeadlines.length > 0 ? Math.min(...futureDeadlines) : null;
}

export function reduceSessionCommand(
  state: SessionState,
  envelope: CommandEnvelope,
  dependencies: SessionDependencies
): SessionCommandTransition {
  const reconciled = reconcileSessionDeadlines(state, envelope.receivedAt);
  const currentState = reconciled.state;
  const { command } = envelope;

  let mutation: CommandMutation;
  if (currentState.phase === 'ended') {
    mutation = error(currentState, 'SESSION_ENDED', 'Sesi ini sudah berakhir.');
  } else if (
    command.expectedRevision !== undefined &&
    command.expectedRevision !== currentState.revision
  ) {
    mutation = error(
      currentState,
      'STALE_REVISION',
      'Tampilanmu sudah tertinggal. Gunakan keadaan sesi terbaru.'
    );
  } else {
    const actorError = requireConnectedActor(currentState, envelope.actorId);
    mutation = actorError
      ? { state: currentState, error: actorError }
      : dispatchCommand(currentState, envelope, dependencies);
  }

  let finalState = mutation.state;
  if (finalState !== currentState) {
    finalState = {
      ...finalState,
      revision: currentState.revision + 1,
    } as SessionState;
  }
  const acknowledgement: CommandAcknowledgement = mutation.error
    ? {
        type: 'command-ack',
        commandId: command.id,
        ok: false,
        revision: finalState.revision,
        error: mutation.error,
      }
    : {
        type: 'command-ack',
        commandId: command.id,
        ok: true,
        revision: finalState.revision,
      };

  return {
    state: finalState,
    acknowledgement,
    events: [...reconciled.events, ...(mutation.events ?? [])],
  };
}

function updatePresence(
  state: SessionState,
  participantId: string,
  now: number,
  connected: boolean
): SessionLifecycleTransition {
  const reconciledBeforePresence = reconcileSessionDeadlines(state, now);
  const currentState = reconciledBeforePresence.state;
  if (currentState.mode === 'single-device') return reconciledBeforePresence;

  const participant = getActiveParticipant(currentState, participantId);
  if (!participant || participant.connected === connected) {
    return reconciledBeforePresence;
  }

  const participants = {
    ...currentState.participants,
    [participantId]: {
      ...participant,
      connected,
      connectedAt: connected ? now : null,
      disconnectedAt: connected ? null : now,
    },
  };
  const baseState: OwnDeviceSessionState = { ...currentState, participants };
  const reconciledAfterPresence = reconcileWithoutRevision(baseState, now);
  return {
    state: {
      ...reconciledAfterPresence.state,
      revision: currentState.revision + 1,
    } as SessionState,
    events: [
      ...reconciledBeforePresence.events,
      ...reconciledAfterPresence.events,
    ],
  };
}

export function connectParticipant(
  state: SessionState,
  participantId: string,
  now: number
): SessionLifecycleTransition {
  return updatePresence(state, participantId, now, true);
}

export function disconnectParticipant(
  state: SessionState,
  participantId: string,
  now: number
): SessionLifecycleTransition {
  return updatePresence(state, participantId, now, false);
}

export function departParticipant(
  state: SessionState,
  participantId: string,
  now: number
): SessionLifecycleTransition {
  if (state.mode === 'single-device') {
    if (participantId !== state.controllerId) return { state, events: [] };
    return {
      state: { ...state, phase: 'ended', revision: state.revision + 1 },
      events: [{ type: 'session-ended' }],
    };
  }
  const participant = getActiveParticipant(state, participantId);
  if (!participant) return reconcileSessionDeadlines(state, now);

  let baseState: OwnDeviceSessionState;
  if (state.phase === 'lobby') {
    const participants = { ...state.participants };
    delete participants[participantId];
    baseState = {
      ...state,
      participants: resetAllReadiness(participants),
      teamOrder: {
        team1: state.teamOrder.team1.filter((id) => id !== participantId),
        team2: state.teamOrder.team2.filter((id) => id !== participantId),
      },
      configuration: {
        ...state.configuration,
        players: activeParticipants(state).length - 1,
      },
    };
  } else {
    baseState = {
      ...state,
      participants: {
        ...state.participants,
        [participantId]: {
          ...participant,
          ready: false,
          connected: false,
          connectedAt: null,
          disconnectedAt: now,
          departureStatus: 'departed',
        },
      },
    };
  }

  if (participantId === baseState.controllerId) {
    const replacement = chooseReplacementController(baseState, participantId);
    if (replacement) baseState = { ...baseState, controllerId: replacement.id };
  }
  const reconciled = reconcileWithoutRevision(baseState, now);
  return {
    state: {
      ...reconciled.state,
      revision: state.revision + 1,
    } as SessionState,
    events: reconciled.events,
  };
}
