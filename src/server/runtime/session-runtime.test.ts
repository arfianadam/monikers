import { describe, expect, it } from 'vitest';

import type { Card } from '@/features/game/domain/game-types';

import { SessionRuntime } from './session-runtime';

const catalog: Card[] = Array.from({ length: 24 }, (_, index) => ({
  level: ((index % 4) + 1) as 1 | 2 | 3 | 4,
  word: `Kartu ${index + 1}`,
  description: `Deskripsi ${index + 1}`,
}));

describe('SessionRuntime commands', () => {
  it('returns the cached result without applying a duplicate command again', async () => {
    const runtime = new SessionRuntime({
      now: () => 1_000,
      catalog,
      random: () => 0.5,
    });

    try {
      const { record, credential } = runtime.repository.create('single-device');
      await runtime.connect(record, credential.actorId);

      const first = await runtime.executeCommand(record, credential.actorId, {
        id: 'same-command',
        type: 'update-setup',
        players: 2,
      });
      const duplicateWithDifferentPayload = await runtime.executeCommand(
        record,
        credential.actorId,
        {
          id: 'same-command',
          type: 'update-setup',
          players: 20,
        }
      );

      expect(first?.acknowledgement).toMatchObject({
        commandId: 'same-command',
        ok: true,
        revision: 1,
      });
      expect(duplicateWithDifferentPayload?.acknowledgement).toEqual(
        first?.acknowledgement
      );
      expect(record.state.configuration.players).toBe(2);
      expect(record.state.revision).toBe(1);

      const rateLimited = await runtime.rejectRateLimitedCommand(
        record,
        credential.actorId,
        'blocked-command'
      );
      const duplicateRateLimited = await runtime.executeCommand(
        record,
        credential.actorId,
        {
          id: 'blocked-command',
          type: 'update-setup',
          players: 3,
        }
      );

      expect(rateLimited?.acknowledgement).toMatchObject({
        commandId: 'blocked-command',
        ok: false,
        error: { code: 'RATE_LIMITED' },
      });
      expect(duplicateRateLimited?.acknowledgement).toEqual(
        rateLimited?.acknowledgement
      );
      expect(record.state.configuration.players).toBe(2);
      expect(record.state.revision).toBe(1);
    } finally {
      runtime.close();
    }
  });
});
