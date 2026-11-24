export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Best-effort, per-instance fixed-window limiter. Vercel functions are
 * ephemeral, so this reduces accidental hammering but is not a global quota.
 */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, Window>();
  private readonly maxKeys: number;

  constructor(maxKeys = 5_000) {
    this.maxKeys = maxKeys;
  }

  consume(
    key: string,
    limit: number,
    windowMs: number,
    now = Date.now(),
  ): RateLimitResult {
    this.prune(now);

    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      this.windows.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: Math.max(0, limit - 1), resetAt };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.resetAt,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, limit - existing.count),
      resetAt: existing.resetAt,
    };
  }

  reset(): void {
    this.windows.clear();
  }

  private prune(now: number): void {
    if (this.windows.size < this.maxKeys) return;

    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }

    if (this.windows.size < this.maxKeys) return;

    const overflow = this.windows.size - this.maxKeys + 1;
    let removed = 0;
    for (const key of this.windows.keys()) {
      this.windows.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}

export const loginMinuteLimiter = new FixedWindowRateLimiter();
export const loginHourLimiter = new FixedWindowRateLimiter();
export const dataLimiter = new FixedWindowRateLimiter();
export const demoLimiter = new FixedWindowRateLimiter();
export const directoryLimiter = new FixedWindowRateLimiter();
