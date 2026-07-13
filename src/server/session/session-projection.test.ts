import { describe, expect, it } from 'vitest';

import type { Card } from '@/features/game/domain/game-types';
import type { SessionCommand } from '@/features/game/session-protocol/types';
import { sessionProjectionSchema } from '@/features/game/session-protocol/schemas';
import { connectParticipant, reduceSessionCommand } from './session-reducer';
import { projectSession } from './session-projection';
import {
  activateOwnDeviceSession,
  addOwnDeviceParticipant,
  createPendingSession,
  type OwnDeviceSessionState,
  type SessionState,
} from './session-state';

const catalog: Card[] = Array.from({ length: 8 }, (_, index) => ({
  level: 1,
  word: `Rahasia ${index + 1}`,
  description: `Petunjuk ${index + 1}`,
}));
const dependencies = { catalog, random: () => 0.5 };

function own(state: SessionState): OwnDeviceSessionState {
  if (state.mode !== 'own-device') throw new Error('Expected own-device state');
  return state;
}

function command(
  state: SessionState,
  actorId: string,
  receivedAt: number,
  value: SessionCommand
): SessionState {
  const transition = reduceSessionCommand(
    state,
    { actorId, receivedAt, command: value },
    dependencies
  );
  expect(transition.acknowledgement.ok).toBe(true);
  return transition.state;
}

function createSelection(): OwnDeviceSessionState {
  let state = own(
    createPendingSession({
      sessionId: 'private-session',
      mode: 'own-device',
      controllerId: 'one',
      now: 0,
    })
  );
  const activated = activateOwnDeviceSession(state, {
    participantId: 'one',
    displayName: 'Satu',
    joinCode: 'PRV234',
    now: 1,
  });
  if (activated.error) throw new Error(activated.error.message);
  state = activated.state;
  const joined = addOwnDeviceParticipant(state, {
    participantId: 'two',
    displayName: 'Dua',
    now: 2,
  });
  if (joined.error) throw new Error(joined.error.message);
  state = joined.state;
  state = own(connectParticipant(state, 'one', 3).state);
  state = own(connectParticipant(state, 'two', 4).state);
  state = own(
    command(state, 'one', 5, {
      id: 'configuration',
      type: 'update-setup',
      cardsPerPlayer: 1,
    })
  );
  state = own(
    command(state, 'one', 6, {
      id: 'ready-one',
      type: 'set-ready',
      ready: true,
    })
  );
  state = own(
    command(state, 'two', 7, {
      id: 'ready-two',
      type: 'set-ready',
      ready: true,
    })
  );
  return own(
    command(state, 'one', 8, {
      id: 'start-selection',
      type: 'start-selection',
    })
  );
}

describe('recipient-specific session projections', () => {
  it('shows only the recipient offer during simultaneous selection', () => {
    const state = createSelection();
    const forOne = projectSession(state, {
      participantId: 'one',
      serverTime: 10,
    });
    const forTwo = projectSession(state, {
      participantId: 'two',
      serverTime: 10,
    });

    expect(forOne.phase).toBe('selection');
    expect(forTwo.phase).toBe('selection');
    if (forOne.phase !== 'selection' || forTwo.phase !== 'selection') return;
    expect(forOne.offer?.map((card) => card.word)).toEqual([
      'Rahasia 1',
      'Rahasia 2',
      'Rahasia 3',
    ]);
    expect(forTwo.offer?.map((card) => card.word)).toEqual([
      'Rahasia 4',
      'Rahasia 5',
      'Rahasia 6',
    ]);
    expect(JSON.stringify(forOne)).not.toContain('Rahasia 4');
    expect(sessionProjectionSchema.safeParse(forOne).success).toBe(true);
  });

  it('reveals the active card and controls only to the clue-giver', () => {
    let state = createSelection();
    const selectionId = state.selection!.id;
    for (const [actorId, cardWord] of [
      ['one', 'Rahasia 1'],
      ['two', 'Rahasia 4'],
    ] as const) {
      state = own(
        command(state, actorId, 11, {
          id: `toggle-${actorId}`,
          type: 'toggle-card',
          selectionId,
          cardWord,
        })
      );
      state = own(
        command(state, actorId, 12, {
          id: `confirm-${actorId}`,
          type: 'confirm-selection',
          selectionId,
        })
      );
    }
    const turnId = state.game.turn!.id;
    state = own(
      command(state, 'one', 20, {
        id: 'start-turn',
        type: 'start-turn',
        turnId,
      })
    );

    const active = projectSession(state, {
      participantId: 'one',
      serverTime: 20,
    });
    const watcher = projectSession(state, {
      participantId: 'two',
      serverTime: 20,
    });
    expect(active.phase).toBe('turn');
    expect(watcher.phase).toBe('turn');
    if (active.phase !== 'turn' || watcher.phase !== 'turn') return;
    expect(active.card?.word).toBe('Rahasia 1');
    expect(active.inactivityTimeoutEnabled).toBe(true);
    expect(active.clueGiverConnected).toBe(true);
    expect(active.controls).toMatchObject({
      canMarkCorrect: true,
      canEnd: true,
    });
    expect(watcher.card).toBeUndefined();
    expect(watcher.controls).toBeUndefined();
    expect(JSON.stringify(watcher)).not.toContain('Rahasia 1');
    expect(sessionProjectionSchema.safeParse(active).success).toBe(true);
    expect(sessionProjectionSchema.safeParse(watcher).success).toBe(true);
  });
});
