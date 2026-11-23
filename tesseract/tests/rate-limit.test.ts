import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter } from "@/lib/security/rate-limit";

describe("fixed-window rate limiter", () => {
  it("allows the limit and then blocks until the window resets", () => {
    const limiter = new FixedWindowRateLimiter();

    expect(limiter.consume("ip", 2, 1_000, 0)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(limiter.consume("ip", 2, 1_000, 100)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(limiter.consume("ip", 2, 1_000, 200)).toMatchObject({
      allowed: false,
      remaining: 0,
    });
    expect(limiter.consume("ip", 2, 1_000, 1_000).allowed).toBe(true);
  });

  it("keeps separate keys independent", () => {
    const limiter = new FixedWindowRateLimiter();
    expect(limiter.consume("a", 1, 1_000, 0).allowed).toBe(true);
    expect(limiter.consume("a", 1, 1_000, 1).allowed).toBe(false);
    expect(limiter.consume("b", 1, 1_000, 1).allowed).toBe(true);
  });
});
