import type { RoundNumber, TeamId } from '@/features/game/domain/game-types';
import { getCardPoints, getTeamTotal } from '@/features/game/domain/scoring';
import type {
  ParticipantPresence,
  ParticipantProjection,
  ScorePointsProjection,
  SessionProjection,
} from '@/features/game/session-protocol/types';
import { isOwnDeviceLobbyReady } from './session-reducer';
import type {
  OwnDeviceParticipantState,
  OwnDeviceSessionState,
  SessionState,
} from './session-state';

export interface SessionProjectionRecipient {
  participantId: string | null;
  serverTime: number;
}

function participantPresence(
  participant: OwnDeviceParticipantState
): ParticipantPresence {
  if (participant.departureStatus === 'departed') return 'departed';
  return participant.connected ? 'connected' : 'disconnected';
}

function projectParticipant(
  state: OwnDeviceSessionState,
  participant: OwnDeviceParticipantState
): ParticipantProjection {
  return {
    id: participant.id,
    displayName: participant.displayName,
    team: participant.team,
    ready: participant.ready,
    presence: participantPresence(participant),
    isController: participant.id === state.controllerId,
  };
}

function orderedParticipants(
  state: OwnDeviceSessionState
): OwnDeviceParticipantState[] {
  return Object.values(state.participants).sort(
    (first, second) => first.joinOrder - second.joinOrder
  );
}

function scorePoints(state: SessionState): ScorePointsProjection {
  function teamPoints(team: TeamId) {
    const rounds: Partial<Record<RoundNumber, number>> = {};
    for (const round of [1, 2, 3] as const) {
      const cards = state.game.scores[team][round];
      if (cards) rounds[round] = getCardPoints(cards);
    }
    return { total: getTeamTotal(state.game.scores, team), rounds };
  }

  return { team1: teamPoints('team1'), team2: teamPoints('team2') };
}

export function projectSession(
  state: SessionState,
  { participantId, serverTime }: SessionProjectionRecipient
): SessionProjection {
  const base = {
    sessionId: state.sessionId,
    mode: state.mode,
    recipientId: participantId,
    isController: participantId === state.controllerId,
    version: state.revision,
    serverTime,
  };

  if (state.phase === 'ended') {
    return { ...base, phase: 'ended' };
  }

  if (state.phase === 'pending') {
    return {
      ...base,
      phase: 'pending',
      canActivate: participantId === state.controllerId,
    };
  }

  if (state.mode === 'single-device' && state.phase === 'setup') {
    return {
      ...base,
      mode: 'single-device',
      phase: 'setup',
      configuration: state.configuration,
      canManage: participantId === state.controllerId,
    };
  }

  if (state.mode === 'own-device' && state.phase === 'lobby') {
    const roomReady = isOwnDeviceLobbyReady(state);
    return {
      ...base,
      mode: 'own-device',
      phase: 'lobby',
      configuration: state.configuration,
      joinCode: state.joinCode,
      controllerId: state.controllerId,
      participants: orderedParticipants(state).map((participant) =>
        projectParticipant(state, participant)
      ),
      teamOrder: state.teamOrder,
      canManage: participantId === state.controllerId,
      roomReady,
      canStart: participantId === state.controllerId && roomReady,
    };
  }

  if (state.phase === 'selection' && state.selection) {
    if (state.mode === 'single-device') {
      const isController = participantId === state.controllerId;
      return {
        ...base,
        phase: 'selection',
        selectionId: state.selection.id,
        configuration: state.configuration,
        statuses: Array.from(
          { length: state.configuration.players },
          (_, index) => ({
            participantId: `player-${index + 1}`,
            displayName: `Pemain ${index + 1}`,
            status:
              index + 1 < state.selection!.currentPlayer
                ? ('done' as const)
                : ('selecting' as const),
          })
        ),
        currentPlayer: state.selection.currentPlayer,
        offer:
          isController && state.selection.revealed
            ? state.selection.offer
            : undefined,
        draft:
          isController && state.selection.revealed
            ? state.selection.draft
            : undefined,
        confirmed: false,
        blockedParticipantIds: [],
        canReveal: isController && !state.selection.revealed,
        canEdit: isController && state.selection.revealed,
        canCancel: isController,
      };
    }

    const recipientIsSelecting =
      participantId !== null &&
      state.selection.participantIds.includes(participantId);
    const confirmed =
      participantId !== null &&
      state.selection.confirmedParticipantIds.includes(participantId);
    const blockedParticipantIds = state.selection.participantIds.filter(
      (id) =>
        !state.selection?.confirmedParticipantIds.includes(id) &&
        (!state.participants[id] ||
          state.participants[id].departureStatus === 'departed')
    );
    return {
      ...base,
      phase: 'selection',
      selectionId: state.selection.id,
      configuration: state.configuration,
      statuses: state.selection.participantIds.map((id) => ({
        participantId: id,
        displayName: state.participants[id]?.displayName ?? 'Pemain',
        status: state.selection!.confirmedParticipantIds.includes(id)
          ? 'done'
          : 'selecting',
      })),
      offer:
        recipientIsSelecting && participantId
          ? state.selection.offers[participantId]
          : undefined,
      draft:
        recipientIsSelecting && participantId
          ? state.selection.drafts[participantId]
          : undefined,
      confirmed,
      blockedParticipantIds,
      canEdit: recipientIsSelecting && !confirmed,
      canCancel:
        participantId === state.controllerId &&
        blockedParticipantIds.length > 0,
    };
  }

  if (state.phase === 'turn' && state.game.turn) {
    const turn = state.game.turn;
    const isClueGiver = participantId === turn.clueGiverId;
    const clueGiverName =
      state.mode === 'own-device' && turn.clueGiverId
        ? (state.participants[turn.clueGiverId]?.displayName ?? null)
        : turn.clueGiverId
          ? 'Pemberi petunjuk'
          : null;
    const participantConnected =
      state.mode === 'single-device' ||
      (participantId !== null &&
        state.participants[participantId]?.connected === true);

    return {
      ...base,
      phase: 'turn',
      round: state.game.round,
      currentTeam: turn.currentTeam,
      clueGiverId: turn.clueGiverId,
      clueGiverName,
      turnId: turn.id,
      turnActive: turn.active,
      turnEndsAt: turn.endsAt,
      clueGiverWaitEndsAt: turn.clueGiverWaitEndsAt,
      initialCardCount: state.game.chosenDeck.length,
      remainingCardCount: state.game.remainingCards.length,
      guessedCardCount: turn.guessedCards.length,
      scores: scorePoints(state),
      card:
        isClueGiver && turn.active ? state.game.remainingCards[0] : undefined,
      controls:
        isClueGiver && participantConnected
          ? {
              canStart: !turn.active,
              canMarkCorrect:
                turn.active &&
                (turn.lastCorrectAt === null ||
                  serverTime >= turn.lastCorrectAt + 1_000),
              canSkip:
                turn.active &&
                turn.canSkip &&
                state.game.remainingCards.length > 1,
              canEnd: turn.active,
            }
          : undefined,
    };
  }

  if (state.phase === 'round-score' || state.phase === 'final-score') {
    return {
      ...base,
      phase: state.phase,
      round: state.game.round,
      scores: state.game.scores,
      canContinue: participantId === state.controllerId,
    };
  }

  throw new Error(`Unsupported session projection phase: ${state.phase}`);
}
