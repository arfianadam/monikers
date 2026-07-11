import { describe, expect, it, vi } from 'vitest';

import { createCommandId } from './command-id';

describe('createCommandId', () => {
  it('uses the platform UUID generator when it is available', () => {
    const randomUUID = vi.fn(() => 'platform-command-id');
    const source = { randomUUID } as unknown as Crypto;

    expect(createCommandId(source)).toBe('platform-command-id');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('creates a secure UUID v4 when randomUUID is unavailable', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set(Array.from({ length: 16 }, (_, index) => index));
      return bytes;
    });
    const source = { getRandomValues } as unknown as Crypto;

    expect(createCommandId(source)).toBe(
      '00010203-0405-4607-8809-0a0b0c0d0e0f'
    );
    expect(getRandomValues).toHaveBeenCalledOnce();
  });
});
