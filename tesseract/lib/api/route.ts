import { NextResponse } from "next/server";
import { apiFailure, apiSuccess } from "@/lib/api/envelope";
import {
  ApiProblem,
  RateLimitedProblem,
} from "@/lib/security/errors";
import { clearSessionCookie, applySessionCookie } from "@/lib/session/current";
import type { Session } from "@/lib/session/schema";
import type { ProviderResult } from "@/lib/providers/types";
import type { Warning } from "@/lib/types";

export function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    "X-Robots-Tag": "noindex",
  };
}

export function apiJson<T>(
  data: T,
  warnings: readonly Warning[] = [],
  fetchedAt?: string,
): NextResponse {
  return NextResponse.json(apiSuccess(data, warnings, fetchedAt), {
    headers: noStoreHeaders(),
  });
}

export function providerJson<T>(
  session: Session,
  result: ProviderResult<T>,
): NextResponse {
  const response = apiJson(result.data, result.warnings, result.fetchedAt);
  if (result.cookies) {
    applySessionCookie(response, { ...session, cookies: result.cookies });
  }
  return response;
}

export function sessionJson<T>(
  session: Session,
  data: T,
  warnings: readonly Warning[] = [],
  cookies?: Session["cookies"],
): NextResponse {
  const response = apiJson(data, warnings);
  if (cookies) {
    applySessionCookie(response, { ...session, cookies });
  }
  return response;
}

export async function handleApi(
  operation: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await operation();
  } catch (error) {
    const problem =
      error instanceof ApiProblem
        ? error
        : new ApiProblem("internal_error", "Something went wrong. Try again.");

    if (!(error instanceof ApiProblem)) {
      // Never log request bodies, credentials or upstream HTML.
      console.error(
        "tesseract_api_unhandled",
        error instanceof Error ? error.name : "unknown",
      );
    }

    const response = NextResponse.json(
      apiFailure(problem.code, problem.message, problem.details),
      { status: problem.status, headers: noStoreHeaders() },
    );

    if (
      problem.code === "unauthorized" ||
      problem.code === "session_expired"
    ) {
      clearSessionCookie(response);
    }

    if (problem instanceof RateLimitedProblem) {
      const seconds = Number(problem.details?.retryAfterSeconds);
      response.headers.set(
        "Retry-After",
        String(Number.isFinite(seconds) ? Math.max(1, seconds) : 60),
      );
    }

    return response;
  }
}
