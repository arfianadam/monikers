import { describe, expect, it } from 'vitest';

import {
  SESSION_IDLE_TTL_MS,
  InMemorySessionRepository,
} from './session-repository';

describe('InMemorySessionRepository', () => {
  it('indexes live join codes and authenticates only active credentials', () => {
    let sequence = 0;
    const repository = new InMemorySessionRepository({
      now: () => 1_000,
      sessionId: () => `session-${sequence++}`,
      credentialToken: () => `secret-${sequence++}`,
    });
    const created = repository.create('own-device');
    const joinCode = repository.allocateJoinCode();

    if (created.record.state.mode !== 'own-device') {
      throw new Error('Expected own-device session');
    }

    repository.replaceState(created.record, {
      ...created.record.state,
      joinCode,
    });

    expect(repository.findByJoinCode(joinCode)).toBe(created.record);
    expect(
      repository.authenticate(
        created.record.state.sessionId,
        created.credential.token
      )?.credential.actorId
    ).toBe(created.credential.actorId);

    repository.revokeCredential(created.record, created.credential.token);
    expect(
      repository.authenticate(
        created.record.state.sessionId,
        created.credential.token
      )
    ).toBeNull();
    expect(created.record.credentials.size).toBe(0);
  });

  it('removes only rooms idle for a full day', () => {
    let now = 10_000;
    let sequence = 0;
    const repository = new InMemorySessionRepository({
      now: () => now,
      sessionId: () => `session-${sequence++}`,
      credentialToken: () => `secret-${sequence++}`,
    });
    const idle = repository.create('single-device').record;
    const connected = repository.create('single-device').record;
    repository.markConnected(connected, connected.state.controllerId);

    now += SESSION_IDLE_TTL_MS + 1;
    expect(repository.cleanupExpired()).toEqual([idle.state.sessionId]);
    expect(repository.get(connected.state.sessionId)).toBe(connected);
  });

  it('serializes operations for one room', async () => {
    const repository = new InMemorySessionRepository();
    const record = repository.create('single-device').record;
    const order: number[] = [];

    const first = repository.enqueue(record, async () => {
      await Promise.resolve();
      order.push(1);
    });
    const second = repository.enqueue(record, () => order.push(2));

    await Promise.all([first, second]);
    expect(order).toEqual([1, 2]);
  });

  it('scopes idempotency results by actor and expires old entries', () => {
    let now = 1_000;
    const repository = new InMemorySessionRepository({ now: () => now });
    const record = repository.create('single-device').record;
    const acknowledgement = {
      type: 'command-ack' as const,
      commandId: 'shared-id',
      ok: true as const,
      revision: 1,
    };

    repository.cacheCommand(record, 'actor-a', acknowledgement);

    expect(repository.getCachedCommand(record, 'actor-a', 'shared-id')).toBe(
      acknowledgement
    );
    expect(
      repository.getCachedCommand(record, 'actor-b', 'shared-id')
    ).toBeNull();

    now += 10 * 60 * 1_000 + 1;
    expect(
      repository.getCachedCommand(record, 'actor-a', 'shared-id')
    ).toBeNull();
    expect(record.recentCommands.size).toBe(0);
  });
});
