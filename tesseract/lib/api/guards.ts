import type { NextRequest } from "next/server";
import { getClientIp, hashToken } from "@/lib/security/request";
import { RateLimitedProblem } from "@/lib/security/errors";
import {
  dataLimiter,
  demoLimiter,
  directoryLimiter,
  loginHourLimiter,
  loginMinuteLimiter,
} from "@/lib/security/rate-limit";
import type { Session } from "@/lib/session/schema";

function retrySeconds(resetAt: number, now: number): number {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

export function guardLogin(request: NextRequest, username: string): void {
  const now = Date.now();
  const ip = getClientIp(request);
  const userKey = hashToken(username.trim().toLowerCase());

  const minute = loginMinuteLimiter.consume(`login:minute:${ip}`, 5, 60_000, now);
  if (!minute.allowed) throw new RateLimitedProblem(retrySeconds(minute.resetAt, now));

  const hour = loginHourLimiter.consume(`login:hour:${userKey}`, 20, 3_600_000, now);
  if (!hour.allowed) throw new RateLimitedProblem(retrySeconds(hour.resetAt, now));
}

export function guardDemo(request: NextRequest): void {
  const now = Date.now();
  const ip = getClientIp(request);
  const result = demoLimiter.consume(`demo:${ip}`, 10, 60_000, now);
  if (!result.allowed) throw new RateLimitedProblem(retrySeconds(result.resetAt, now));
}

export function guardDirectory(request: NextRequest): void {
  const now = Date.now();
  const result = directoryLimiter.consume(
    `directory:${getClientIp(request)}`,
    30,
    60_000,
    now,
  );
  if (!result.allowed) throw new RateLimitedProblem(retrySeconds(result.resetAt, now));
}

export function guardData(request: NextRequest, session: Session): void {
  const now = Date.now();
  const key = hashToken(
    `${getClientIp(request)}|${session.district.id}|${session.activeStudentId}`,
  );
  const result = dataLimiter.consume(`data:${key}`, 120, 60_000, now);
  if (!result.allowed) throw new RateLimitedProblem(retrySeconds(result.resetAt, now));
}
