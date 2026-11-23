import type { NextRequest, NextResponse } from "next/server";
import { sealSession, openSession, sessionCookieName, sessionCookieOptions } from "./crypto";
import type { Session } from "./schema";
import { UnauthorizedProblem } from "@/lib/security/errors";

export function readSession(request: NextRequest): Session {
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
  response.cookies.set(sessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}
