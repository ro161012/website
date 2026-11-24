import type { NextRequest, NextResponse } from "next/server";
import {
  logoutCookieName,
  sealSession,
  openSession,
  sessionCookieName,
  sessionCookieOptions,
  sessionCookieSecure,
} from "./crypto";
import type { Session } from "./schema";
import { UnauthorizedProblem } from "@/lib/security/errors";

export function readSession(request: NextRequest): Session {
  if (request.cookies.get(logoutCookieName())?.value === "1") {
    throw new UnauthorizedProblem();
  }
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) throw new UnauthorizedProblem();
  return openSession(token);
}

export function applySessionCookie(response: NextResponse, session: Session): void {
  response.cookies.set(
    sessionCookieName(),
    sealSession(session),
    sessionCookieOptions(session),
  );
}

export function clearSessionCookie(response: NextResponse): void {
  const secure = sessionCookieSecure();
  response.cookies.set(sessionCookieName(), "", {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  response.cookies.set(logoutCookieName(), "1", {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 60,
    expires: new Date(Date.now() + 60_000),
  });
}

/** Clear the logout marker only after a new session has been established. */
export function clearLogoutCookie(response: NextResponse): void {
  response.cookies.set(logoutCookieName(), "", {
    httpOnly: true,
    secure: sessionCookieSecure(),
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}
