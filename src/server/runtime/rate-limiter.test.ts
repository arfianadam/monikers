import { describe, expect, it } from 'vitest';

import { SlidingWindowRateLimiter } from './rate-limiter';

describe('SlidingWindowRateLimiter', () => {
  it('rejects attempts inside the window and recovers after it expires', () => {
    let now = 1_000;
    const limiter = new SlidingWindowRateLimiter(() => now);
    const rule = { limit: 2, windowMs: 1_000 };

    expect(limiter.consume('client', rule).allowed).toBe(true);
    expect(limiter.consume('client', rule).allowed).toBe(true);
    expect(limiter.consume('client', rule)).toMatchObject({
      allowed: false,
      retryAfterMs: 1_000,
    });

    now += 1_001;
    expect(limiter.consume('client', rule).allowed).toBe(true);
  });
});
