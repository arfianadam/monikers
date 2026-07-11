import { describe, expect, it } from 'vitest';

import type { Card, TeamId } from '@/features/game/domain/game-types';
import type { SessionCommand } from '@/features/game/session-protocol/types';
import {
  connectParticipant,
  departParticipant,
  disconnectParticipant,
  getNextSessionDeadline,
  reconcileSessionDeadlines,
  reduceSessionCommand,
} from './session-reducer';
import {
  activateOwnDeviceSession,
  addOwnDeviceParticipant,
  createPendingSession,
  validateDisplayName,
  type OwnDeviceSessionState,
  type SessionState,
} from './session-state';

const catalog: Card[] = Array.from({ length: 24 }, (_, index) => ({
  level: ((index % 4) + 1) as 1 | 2 | 3 | 4,
  word: `Kartu ${index + 1}`,
  description: `Deskripsi ${index + 1}`,
}));
const maximumCatalog: Card[] = Array.from({ length: 240 }, (_, index) => ({
  level: ((index % 4) + 1) as 1 | 2 | 3 | 4,
  word: `Kartu maksimum ${index + 1}`,
  description: `Deskripsi maksimum ${index + 1}`,
}));
const keepOrder = () => 0.5;
const dependencies = { catalog, random: keepOrder };

type CommandWithoutId = SessionCommand extends infer Command
  ? Command extends SessionCommand
    ? Omit<Command, 'id'>
    : never
  : never;

let commandSequence = 0;

function own(state: SessionState): OwnDeviceSessionState {
  if (state.mode !== 'own-device') throw new Error('Expected own-device state');
  return state;
}

function apply(
  state: SessionState,
  actorId: string,
  receivedAt: number,
  command: CommandWithoutId,
  commandDependencies = dependencies
): SessionState {
  commandSequence += 1;
  const transition = reduceSessionCommand(
    state,
    {
      actorId,
      receivedAt,
      command: {
        ...command,
        id: `command-${commandSequence}`,
      } as SessionCommand,
    },
    commandDependencies
  );
  expect(transition.acknowledgement).toMatchObject({ ok: true });
  return transition.state;
}

function createLobby(playerIds = ['creator', 'guest']): OwnDeviceSessionState {
  let state = own(
    createPendingSession({
      sessionId: 'session-1',
      mode: 'own-device',
      controllerId: playerIds[0],
      now: 0,
    })
  );
  const activated = activateOwnDeviceSession(state, {
    participantId: playerIds[0],
    displayName: 'Ayu',
    joinCode: 'ABC234',
    now: 1,
  });
  if (activated.error) throw new Error(activated.error.message);
  state = activated.state;

  for (let index = 1; index < playerIds.length; index += 1) {
    const joined = addOwnDeviceParticipant(state, {
      participantId: playerIds[index],
      displayName: `Pemain ${index + 1}`,
      now: index + 1,
    });
    if (joined.error) throw new Error(joined.error.message);
    state = joined.state;
  }

  for (let index = 0; index < playerIds.length; index += 1) {
    state = own(connectParticipant(state, playerIds[index], 10 + index).state);
  }
  return state;
}

function createSelectingLobby(): OwnDeviceSessionState {
  let state = createLobby();
  state = own(
    apply(state, 'creator', 20, {
      type: 'update-setup',
      cardsPerPlayer: 1,
    })
  );
  state = own(apply(state, 'creator', 21, { type: 'set-ready', ready: true }));
  state = own(apply(state, 'guest', 22, { type: 'set-ready', ready: true }));
  return own(apply(state, 'creator', 23, { type: 'start-selection' }));
}

function createTurnState({
  playerIds = ['creator', 'guest'],
  team = 'team1',
  clueGiverId = 'creator',
  cards = [catalog[0]],
  clueGiverCursors = { team1: 0, team2: 0 },
}: {
  playerIds?: string[];
  team?: TeamId;
  clueGiverId?: string;
  cards?: Card[];
  clueGiverCursors?: Record<TeamId, number>;
} = {}): OwnDeviceSessionState {
  const state = createLobby(playerIds);
  return {
    ...state,
    phase: 'turn',
    frozenTeamOrder: {
      team1: [...state.teamOrder.team1],
      team2: [...state.teamOrder.team2],
    },
    clueGiverCursors,
    game: {
      ...state.game,
      chosenDeck: [...cards],
      remainingCards: [...cards],
      turnSequence: 1,
      turn: {
        id: 1,
        currentTeam: team,
        clueGiverId,
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

describe('session reducer lifecycle', () => {
  it('runs the sequential private selection flow for a single device', () => {
    let state = createPendingSession({
      sessionId: 'single-session',
      mode: 'single-device',
      controllerId: 'controller',
      now: 0,
    });
    state = apply(state, 'controller', 1, {
      type: 'update-setup',
      players: 2,
      cardsPerPlayer: 1,
    });
    state = apply(state, 'controller', 2, { type: 'start-selection' });
    if (state.mode !== 'single-device' || !state.selection) {
      throw new Error('Expected single-device selection');
    }
    const selectionId = state.selection.id;

    for (const player of [1, 2]) {
      state = apply(state, 'controller', 3 + player, {
        type: 'reveal-single-offer',
        selectionId,
      });
      if (state.mode !== 'single-device' || !state.selection) {
        throw new Error('Expected single-device selection');
      }
      const cardWord = state.selection.offer[0].word;
      state = apply(state, 'controller', 5 + player, {
        type: 'toggle-card',
        selectionId,
        cardWord,
      });
      state = apply(state, 'controller', 7 + player, {
        type: 'confirm-selection',
        selectionId,
      });
    }

    expect(state.phase).toBe('turn');
    expect(state.game.chosenDeck).toHaveLength(2);
    expect(new Set(state.game.chosenDeck.map((card) => card.word)).size).toBe(
      2
    );
    expect(state.game.turn).toMatchObject({
      currentTeam: 'team1',
      clueGiverId: 'controller',
    });
  });

  it('accepts joined emoji names while rejecting control characters', () => {
    expect(validateDisplayName('👨‍👩‍👧‍👦')).toBeNull();
    expect(validateDisplayName('Nama\u0000')).toMatchObject({
      code: 'INVALID_NAME',
    });
  });

  it('assigns balanced teams, resets readiness, and transfers control after grace', () => {
    let state = createLobby();
    state = own(
      apply(state, 'creator', 20, { type: 'set-ready', ready: true })
    );
    state = own(apply(state, 'guest', 21, { type: 'set-ready', ready: true }));

    const joined = addOwnDeviceParticipant(state, {
      participantId: 'third',
      displayName: 'Citra',
      now: 22,
    });
    if (joined.error) throw new Error(joined.error.message);
    state = joined.state;

    expect(state.participants.creator.team).toBe('team1');
    expect(state.participants.guest.team).toBe('team2');
    expect(state.participants.third.team).toBe('team1');
    expect(
      Object.values(state.participants).every((player) => !player.ready)
    ).toBe(true);

    state = own(connectParticipant(state, 'third', 30).state);
    state = own(
      apply(state, 'creator', 31, { type: 'set-ready', ready: true })
    );
    state = own(disconnectParticipant(state, 'creator', 100).state);

    expect(getNextSessionDeadline(state, 100)).toBe(30_100);
    expect(reconcileSessionDeadlines(state, 30_099).state.controllerId).toBe(
      'creator'
    );

    state = own(connectParticipant(state, 'creator', 30_100).state);
    expect(state.controllerId).toBe('guest');
    expect(state.participants.creator.connected).toBe(true);
    expect(state.participants.creator.ready).toBe(false);
  });

  it('deals disjoint private offers and completes simultaneous selection', () => {
    let state = createSelectingLobby();
    expect(state.selection?.offers.creator.map((card) => card.word)).toEqual([
      'Kartu 1',
      'Kartu 2',
      'Kartu 3',
    ]);
    expect(state.selection?.offers.guest.map((card) => card.word)).toEqual([
      'Kartu 4',
      'Kartu 5',
      'Kartu 6',
    ]);

    const selectionId = state.selection!.id;
    state = own(
      apply(state, 'creator', 30, {
        type: 'toggle-card',
        selectionId,
        cardWord: 'Kartu 1',
      })
    );
    state = own(
      apply(state, 'creator', 31, {
        type: 'confirm-selection',
        selectionId,
      })
    );
    state = own(
      apply(state, 'guest', 32, {
        type: 'toggle-card',
        selectionId,
        cardWord: 'Kartu 4',
      })
    );
    state = own(
      apply(state, 'guest', 33, {
        type: 'confirm-selection',
        selectionId,
      })
    );

    expect(state.phase).toBe('turn');
    expect(state.game.chosenDeck.map((card) => card.word)).toEqual([
      'Kartu 1',
      'Kartu 4',
    ]);
    expect(state.game.turn).toMatchObject({
      currentTeam: 'team1',
      clueGiverId: 'creator',
      active: false,
    });
  });

  it('atomically deals globally disjoint offers at the 20-player maximum', () => {
    const playerIds = Array.from(
      { length: 20 },
      (_, index) => `player-${index + 1}`
    );
    const maximumDependencies = {
      catalog: maximumCatalog,
      random: keepOrder,
    };
    let state = createLobby(playerIds);

    state = own(
      apply(
        state,
        'player-1',
        100,
        { type: 'update-setup', cardsPerPlayer: 10 },
        maximumDependencies
      )
    );
    for (const [index, playerId] of playerIds.entries()) {
      state = own(
        apply(
          state,
          playerId,
          101 + index,
          { type: 'set-ready', ready: true },
          maximumDependencies
        )
      );
    }

    const lobbyRevision = state.revision;
    state = own(
      apply(
        state,
        'player-1',
        130,
        { type: 'start-selection' },
        maximumDependencies
      )
    );

    expect(state).toMatchObject({
      phase: 'selection',
      revision: lobbyRevision + 1,
      configuration: { players: 20, cardsPerPlayer: 10 },
    });
    expect(state.selection?.participantIds).toEqual(playerIds);
    const offers = Object.values(state.selection?.offers ?? {});
    expect(offers).toHaveLength(20);
    expect(offers.every((offer) => offer.length === 12)).toBe(true);
    const offeredWords = offers.flatMap((offer) =>
      offer.map((card) => card.word)
    );
    expect(offeredWords).toHaveLength(240);
    expect(new Set(offeredWords).size).toBe(240);
  });

  it('enforces the correct cooldown and lets the deadline win a command race', () => {
    let state = createSelectingLobby();
    const selectionId = state.selection!.id;
    for (const [actorId, cardWord] of [
      ['creator', 'Kartu 1'],
      ['guest', 'Kartu 4'],
    ] as const) {
      state = own(
        apply(state, actorId, 30, {
          type: 'toggle-card',
          selectionId,
          cardWord,
        })
      );
      state = own(
        apply(state, actorId, 31, {
          type: 'confirm-selection',
          selectionId,
        })
      );
    }

    const turnId = state.game.turn!.id;
    state = own(apply(state, 'creator', 1_000, { type: 'start-turn', turnId }));
    state = own(
      apply(state, 'creator', 2_000, {
        type: 'correct',
        turnId,
        cardWord: 'Kartu 1',
      })
    );

    const cooldown = reduceSessionCommand(
      state,
      {
        actorId: 'creator',
        receivedAt: 2_500,
        command: {
          id: 'too-fast',
          type: 'correct',
          turnId,
          cardWord: 'Kartu 4',
        },
      },
      dependencies
    );
    expect(cooldown.acknowledgement).toMatchObject({
      ok: false,
      error: { code: 'CORRECT_COOLDOWN' },
    });

    const late = reduceSessionCommand(
      state,
      {
        actorId: 'creator',
        receivedAt: 61_000,
        command: {
          id: 'late-correct',
          type: 'correct',
          turnId,
          cardWord: 'Kartu 4',
        },
      },
      dependencies
    );
    expect(late.acknowledgement).toMatchObject({
      ok: false,
      error: { code: 'STALE_TURN' },
    });
    expect(late.state.game.scores.team1[1]?.map((card) => card.word)).toEqual([
      'Kartu 1',
    ]);
    expect(late.state.game.remainingCards.map((card) => card.word)).toEqual([
      'Kartu 4',
    ]);
    expect(late.state.game.turn).toMatchObject({ currentTeam: 'team2' });
    expect(late.events).toContainEqual({
      type: 'sound',
      sound: 'ring',
      recipientId: 'creator',
    });
  });

  it('only cancels blocked own-device selection and resets turn cursors', () => {
    let state = createSelectingLobby();
    const selectionId = state.selection!.id;
    const healthyCancellation = reduceSessionCommand(
      state,
      {
        actorId: 'creator',
        receivedAt: 30,
        command: {
          id: 'healthy-cancel',
          type: 'cancel-selection',
          selectionId,
        },
      },
      dependencies
    );
    expect(healthyCancellation.acknowledgement).toMatchObject({
      ok: false,
      error: { code: 'INVALID_COMMAND' },
    });

    state = own(departParticipant(state, 'guest', 31).state);
    state = {
      ...state,
      clueGiverCursors: { team1: 7, team2: 9 },
    };
    state = own(
      apply(state, 'creator', 32, {
        type: 'cancel-selection',
        selectionId,
      })
    );
    expect(state.phase).toBe('lobby');
    expect(state.clueGiverCursors).toEqual({ team1: 0, team2: 0 });
  });

  it('skips every disconnected teammate after the scheduled grace expires', () => {
    let state = createLobby([
      'creator',
      'guest',
      'third',
      'fourth',
      'fifth',
      'sixth',
    ]);
    expect(state.teamOrder.team1).toEqual(['creator', 'third', 'sixth']);
    state = own(disconnectParticipant(state, 'creator', 100).state);
    state = own(disconnectParticipant(state, 'third', 10_000).state);
    state = {
      ...state,
      phase: 'turn',
      frozenTeamOrder: state.teamOrder,
      clueGiverCursors: { team1: 0, team2: 0 },
      game: {
        ...state.game,
        chosenDeck: [catalog[0]],
        remainingCards: [catalog[0]],
        turnSequence: 1,
        turn: {
          id: 1,
          currentTeam: 'team1',
          clueGiverId: 'creator',
          clueGiverWaitEndsAt: 30_100,
          active: false,
          startedAt: null,
          endsAt: null,
          guessedCards: [],
          canSkip: true,
          lastCorrectAt: null,
        },
      },
    };

    state = own(reconcileSessionDeadlines(state, 30_100).state);
    expect(state.game.turn).toMatchObject({
      clueGiverId: 'sixth',
      clueGiverWaitEndsAt: null,
    });
  });

  it('rotates each team independently and preserves both cursors across rounds', () => {
    let state = createTurnState({
      playerIds: ['creator', 'guest', 'third', 'fourth'],
    });

    state = own(
      apply(state, 'creator', 100, {
        type: 'start-turn',
        turnId: state.game.turn!.id,
      })
    );
    state = own(
      apply(state, 'creator', 101, {
        type: 'end-turn',
        turnId: state.game.turn!.id,
      })
    );
    expect(state.game.turn).toMatchObject({
      currentTeam: 'team2',
      clueGiverId: 'guest',
    });
    expect(state.clueGiverCursors).toEqual({ team1: 1, team2: 0 });

    state = own(
      apply(state, 'guest', 102, {
        type: 'start-turn',
        turnId: state.game.turn!.id,
      })
    );
    state = own(
      apply(state, 'guest', 103, {
        type: 'end-turn',
        turnId: state.game.turn!.id,
      })
    );
    expect(state.game.turn).toMatchObject({
      currentTeam: 'team1',
      clueGiverId: 'third',
    });
    expect(state.clueGiverCursors).toEqual({ team1: 1, team2: 1 });

    state = own(
      apply(state, 'third', 104, {
        type: 'start-turn',
        turnId: state.game.turn!.id,
      })
    );
    state = own(
      apply(state, 'third', 105, {
        type: 'correct',
        turnId: state.game.turn!.id,
        cardWord: catalog[0].word,
      })
    );
    expect(state.phase).toBe('round-score');
    expect(state.clueGiverCursors).toEqual({ team1: 0, team2: 1 });

    state = own(apply(state, 'creator', 106, { type: 'next-round' }));
    expect(state.game.turn).toMatchObject({
      currentTeam: 'team1',
      clueGiverId: 'creator',
    });
    expect(state.clueGiverCursors).toEqual({ team1: 0, team2: 1 });

    state = own(
      apply(state, 'creator', 107, {
        type: 'start-turn',
        turnId: state.game.turn!.id,
      })
    );
    state = own(
      apply(state, 'creator', 108, {
        type: 'end-turn',
        turnId: state.game.turn!.id,
      })
    );
    expect(state.game.turn).toMatchObject({
      currentTeam: 'team2',
      clueGiverId: 'fourth',
    });
    expect(state.clueGiverCursors).toEqual({ team1: 1, team2: 1 });
  });

  it('pauses a handoff while the active team is fully offline', () => {
    let state = createTurnState({
      playerIds: ['creator', 'guest', 'third', 'fourth'],
    });
    state = own(disconnectParticipant(state, 'guest', 50).state);
    state = own(disconnectParticipant(state, 'fourth', 51).state);

    state = own(
      apply(state, 'creator', 60, {
        type: 'start-turn',
        turnId: state.game.turn!.id,
      })
    );
    state = own(
      apply(state, 'creator', 61, {
        type: 'end-turn',
        turnId: state.game.turn!.id,
      })
    );

    expect(state.game.turn).toMatchObject({
      currentTeam: 'team2',
      clueGiverId: null,
      clueGiverWaitEndsAt: null,
      active: false,
    });
    expect(reconcileSessionDeadlines(state, 100_000).state.game.turn).toEqual(
      state.game.turn
    );

    state = own(connectParticipant(state, 'guest', 100_001).state);
    expect(state.game.turn).toMatchObject({
      currentTeam: 'team2',
      clueGiverId: 'guest',
      clueGiverWaitEndsAt: null,
      active: false,
    });
  });

  it('retains the scheduled clue giver through a grace reconnect and an active reconnect', () => {
    let state = createTurnState({
      playerIds: ['creator', 'guest'],
      team: 'team2',
      clueGiverId: 'guest',
    });

    state = own(disconnectParticipant(state, 'guest', 100).state);
    expect(state.game.turn).toMatchObject({
      clueGiverId: 'guest',
      clueGiverWaitEndsAt: 30_100,
      active: false,
    });

    state = own(connectParticipant(state, 'guest', 30_099).state);
    expect(state.game.turn).toMatchObject({
      clueGiverId: 'guest',
      clueGiverWaitEndsAt: null,
      active: false,
    });

    const turnId = state.game.turn!.id;
    state = own(apply(state, 'guest', 30_100, { type: 'start-turn', turnId }));
    expect(state.game.turn).toMatchObject({
      clueGiverId: 'guest',
      active: true,
      endsAt: 90_100,
    });

    state = own(disconnectParticipant(state, 'guest', 31_000).state);
    expect(state.game.turn).toMatchObject({
      clueGiverId: 'guest',
      active: true,
      endsAt: 90_100,
    });

    state = own(connectParticipant(state, 'guest', 31_500).state);
    expect(state.game.turn).toMatchObject({
      clueGiverId: 'guest',
      active: true,
      endsAt: 90_100,
    });
  });

  it('skips permanently departed players in the frozen rotation', () => {
    let state = createTurnState({
      playerIds: ['creator', 'guest', 'third', 'fourth', 'fifth', 'sixth'],
      team: 'team2',
      clueGiverId: 'guest',
      clueGiverCursors: { team1: 1, team2: 0 },
    });
    expect(state.frozenTeamOrder?.team1).toEqual(['creator', 'third', 'sixth']);

    state = own(departParticipant(state, 'third', 50).state);
    expect(state.participants.third.departureStatus).toBe('departed');
    expect(state.frozenTeamOrder?.team1).toContain('third');

    state = own(
      apply(state, 'guest', 60, {
        type: 'start-turn',
        turnId: state.game.turn!.id,
      })
    );
    state = own(
      apply(state, 'guest', 61, {
        type: 'end-turn',
        turnId: state.game.turn!.id,
      })
    );

    expect(state.game.turn).toMatchObject({
      currentTeam: 'team1',
      clueGiverId: 'sixth',
      clueGiverWaitEndsAt: null,
    });
    expect(state.clueGiverCursors.team1).toBe(2);

    const attemptedReconnect = connectParticipant(state, 'third', 62);
    expect(attemptedReconnect.state).toBe(state);
    expect(own(attemptedReconnect.state).participants.third).toMatchObject({
      departureStatus: 'departed',
      connected: false,
    });
  });

  it('replays into a clean lobby and restarts clue-giver rotation', () => {
    let state = createLobby(['creator', 'guest', 'third', 'fourth']);
    state = {
      ...state,
      phase: 'final-score',
      configuration: { players: 4, cardsPerPlayer: 1 },
      frozenTeamOrder: state.teamOrder,
      clueGiverCursors: { team1: 1, team2: 1 },
      participants: Object.fromEntries(
        Object.entries(state.participants).map(([id, participant]) => [
          id,
          { ...participant, ready: true },
        ])
      ),
      game: {
        selectionSequence: 7,
        turnSequence: 12,
        chosenDeck: [catalog[0], catalog[1]],
        round: 3,
        scores: {
          team1: { 1: [catalog[0]], 2: [catalog[1]], 3: [catalog[0]] },
          team2: { 1: [catalog[1]], 2: [catalog[0]], 3: [catalog[1]] },
        },
        remainingCards: [],
        turn: null,
      },
    };
    state = own(departParticipant(state, 'fourth', 100).state);
    const joinCode = state.joinCode;

    state = own(apply(state, 'creator', 101, { type: 'replay' }));

    expect(state).toMatchObject({
      phase: 'lobby',
      joinCode,
      configuration: { players: 3, cardsPerPlayer: 1 },
      clueGiverCursors: { team1: 0, team2: 0 },
      frozenTeamOrder: null,
      game: {
        selectionSequence: 7,
        turnSequence: 12,
        chosenDeck: [],
        round: 1,
        scores: { team1: {}, team2: {} },
        remainingCards: [],
        turn: null,
      },
    });
    expect(Object.keys(state.participants)).toEqual([
      'creator',
      'guest',
      'third',
    ]);
    expect(
      Object.values(state.participants).every(
        (participant) => !participant.ready
      )
    ).toBe(true);

    for (const [index, playerId] of ['creator', 'guest', 'third'].entries()) {
      state = own(
        apply(state, playerId, 110 + index, {
          type: 'set-ready',
          ready: true,
        })
      );
    }
    state = own(apply(state, 'creator', 120, { type: 'start-selection' }));
    const selectionId = state.selection!.id;
    const selections = state.selection!.participantIds.map(
      (participantId) =>
        [participantId, state.selection!.offers[participantId][0].word] as const
    );
    for (const [index, [participantId, cardWord]] of selections.entries()) {
      state = own(
        apply(state, participantId, 121 + index * 2, {
          type: 'toggle-card',
          selectionId,
          cardWord,
        })
      );
      state = own(
        apply(state, participantId, 122 + index * 2, {
          type: 'confirm-selection',
          selectionId,
        })
      );
    }

    expect(state.game).toMatchObject({
      selectionSequence: 8,
      turnSequence: 13,
      turn: { currentTeam: 'team1', clueGiverId: 'creator' },
    });
  });

  it('rejects controller and clue-giver actions from other players', () => {
    const lobby = createLobby();
    for (const command of [
      { type: 'update-setup', cardsPerPlayer: 2 },
      { type: 'move-player', playerId: 'creator', team: 'team2' },
      { type: 'remove-player', playerId: 'creator' },
      { type: 'rotate-code' },
      { type: 'start-selection' },
    ] as const) {
      const transition = reduceSessionCommand(
        lobby,
        {
          actorId: 'guest',
          receivedAt: 50,
          command: { ...command, id: `unauthorized-${command.type}` },
        },
        dependencies
      );
      expect(transition.acknowledgement).toMatchObject({
        ok: false,
        error: { code: 'NOT_AUTHORIZED' },
      });
      expect(transition.state).toBe(lobby);
    }

    const selecting = createSelectingLobby();
    const selectionId = selecting.selection!.id;
    let turnState = selecting;
    for (const [actorId, cardWord] of [
      ['creator', 'Kartu 1'],
      ['guest', 'Kartu 4'],
    ] as const) {
      turnState = own(
        apply(turnState, actorId, 60, {
          type: 'toggle-card',
          selectionId,
          cardWord,
        })
      );
      turnState = own(
        apply(turnState, actorId, 61, {
          type: 'confirm-selection',
          selectionId,
        })
      );
    }
    const turnId = turnState.game.turn!.id;
    const unauthorizedTurn = reduceSessionCommand(
      turnState,
      {
        actorId: 'guest',
        receivedAt: 62,
        command: { id: 'unauthorized-turn', type: 'start-turn', turnId },
      },
      dependencies
    );
    expect(unauthorizedTurn.acknowledgement).toMatchObject({
      ok: false,
      error: { code: 'NOT_AUTHORIZED' },
    });

    const roundScoreState: OwnDeviceSessionState = {
      ...turnState,
      phase: 'round-score',
      game: { ...turnState.game, turn: null },
    };
    const unauthorizedRound = reduceSessionCommand(
      roundScoreState,
      {
        actorId: 'guest',
        receivedAt: 63,
        command: { id: 'unauthorized-round', type: 'next-round' },
      },
      dependencies
    );
    expect(unauthorizedRound.acknowledgement).toMatchObject({
      ok: false,
      error: { code: 'NOT_AUTHORIZED' },
    });

    const finalScoreState: OwnDeviceSessionState = {
      ...roundScoreState,
      phase: 'final-score',
      game: { ...roundScoreState.game, round: 3 },
    };
    const unauthorizedReplay = reduceSessionCommand(
      finalScoreState,
      {
        actorId: 'guest',
        receivedAt: 64,
        command: { id: 'unauthorized-replay', type: 'replay' },
      },
      dependencies
    );
    expect(unauthorizedReplay.acknowledgement).toMatchObject({
      ok: false,
      error: { code: 'NOT_AUTHORIZED' },
    });
  });
});
