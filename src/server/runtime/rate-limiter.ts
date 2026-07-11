export interface RateLimit {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
}

export class SlidingWindowRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  consume(key: string, rule: RateLimit): RateLimitResult {
    const now = this.now();
    const cutoff = now - rule.windowMs;
    const recent = (this.attempts.get(key) ?? []).filter(
      (attemptedAt) => attemptedAt > cutoff
    );

    if (recent.length >= rule.limit) {
      this.attempts.set(key, recent);
      return {
        allowed: false,
        retryAfterMs: Math.max(1, recent[0] + rule.windowMs - now),
        remaining: 0,
      };
    }

    recent.push(now);
    this.attempts.set(key, recent);
    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: Math.max(0, rule.limit - recent.length),
    };
  }

  clear(key: string) {
    this.attempts.delete(key);
  }

  prune() {
    const now = this.now();
    for (const [key, attempts] of this.attempts) {
      if (attempts.length === 0 || now - attempts.at(-1)! > 60 * 60 * 1_000) {
        this.attempts.delete(key);
      }
    }
  }
}
