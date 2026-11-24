import { describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  logoutCookieName,
  openSession,
  sealSession,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/session/crypto";
import {
  clearLogoutCookie,
  clearSessionCookie,
  readSession,
} from "@/lib/session/current";
import { SessionSchema, SESSION_MAX_JSON_BYTES } from "@/lib/session/schema";
import {
  SessionExpiredProblem,
  SessionTooLargeProblem,
  UnauthorizedProblem,
} from "@/lib/security/errors";
import { TEST_SESSION_INPUT, TEST_STUDENT } from "./fixtures/model";

describe("encrypted session", () => {
  it("round-trips a session without exposing its contents", () => {
    const session = createSession(TEST_SESSION_INPUT);
    const token = sealSession(session);

    expect(token.startsWith("v1.")).toBe(true);
    expect(token).not.toContain(TEST_STUDENT.displayName);
    expect(token).not.toContain(TEST_DISTRICT_BASE_URL);

    expect(openSession(token)).toEqual(session);
  });

  it("rejects a tampered token", () => {
    const token = sealSession(createSession(TEST_SESSION_INPUT));
    const packed = Buffer.from(token.slice(3), "base64url");
    packed[20] = (packed[20] ?? 0) ^ 0x01;
    const tampered = `v1.${packed.toString("base64url")}`;

    expect(() => openSession(tampered)).toThrow(UnauthorizedProblem);
  });

  it("rejects a token sealed with a different secret", () => {
    const token = sealSession(createSession(TEST_SESSION_INPUT));
    const otherSecret = "another-test-secret-that-is-at-least-32-bytes";

    expect(() => openSession(token, otherSecret)).toThrow(UnauthorizedProblem);
  });

  it("rejects an expired session", () => {
    const issuedAt = Date.now() - 13 * 60 * 60 * 1000;
    const token = sealSession(createSession(TEST_SESSION_INPUT, issuedAt));

    expect(() => openSession(token)).toThrow(SessionExpiredProblem);
  });

  it("enforces the twelve-hour cap and active-student invariant", () => {
    const session = createSession(TEST_SESSION_INPUT);
    expect(session.expiresAt - session.issuedAt).toBe(12 * 60 * 60 * 1000);

    expect(() =>
      SessionSchema.parse({
        ...session,
        expiresAt: session.issuedAt + 12 * 60 * 60 * 1000 + 120_000,
      }),
    ).toThrow();

    expect(() =>
      createSession({ ...TEST_SESSION_INPUT, activeStudentId: "stu_missing" }),
    ).toThrow();
  });

  it("refuses to seal an oversized payload", () => {
    const students = Array.from({ length: 10 }, (_value, index) => ({
      ...TEST_STUDENT,
      id: `stu_${index}`,
      displayName: `${index}-${"A".repeat(118)}`,
    }));
    const session = createSession({
      ...TEST_SESSION_INPUT,
      students,
      activeStudentId: "stu_0",
      cookies: Array.from({ length: 40 }, (_value, index) => ({
        name: `cookie_${index}`,
        value: "v".repeat(80),
        domain: "hac.example.edu",
        path: "/",
        secure: true,
        httpOnly: true,
        expiresAt: null,
      })),
    });

    expect(Buffer.byteLength(JSON.stringify(session))).toBeGreaterThan(
      SESSION_MAX_JSON_BYTES,
    );
    expect(() => sealSession(session)).toThrow(SessionTooLargeProblem);
  });

  it("uses a hardened __Host cookie in production and Secure/Strict options", () => {
    const session = createSession(TEST_SESSION_INPUT);
    const options = sessionCookieOptions(session, true);

    expect(sessionCookieName(true, true)).toBe("__Host-tessera_session");
    expect(sessionCookieName(false)).toBe("tessera_session");
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("strict");
    expect(options.path).toBe("/");
    expect(options.expires.getTime()).toBe(session.expiresAt);
    expect(options.maxAge).toBeLessThanOrEqual(12 * 60 * 60);
    expect(options.maxAge).toBeGreaterThan(12 * 60 * 60 - 10);
  });

  it("sets a short logout marker that blocks a resurrected session", () => {
    const session = createSession(TEST_SESSION_INPUT);
    const token = sealSession(session);
    const cleared = NextResponse.json({ ok: true });
    clearSessionCookie(cleared);

    expect(
      cleared.cookies.get(logoutCookieName())?.value,
    ).toBe("1");
    expect(cleared.cookies.get(sessionCookieName())?.value).toBe("");

    const request = new NextRequest("http://localhost/", {
      headers: {
        cookie: `${sessionCookieName()}=${token}; ${logoutCookieName()}=1`,
      },
    });
    expect(() => readSession(request)).toThrow();
  });

  it("clears the logout marker when a new session is established", () => {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(logoutCookieName(), "1");
    clearLogoutCookie(response);
    expect(response.cookies.get(logoutCookieName())?.value).toBe("");
  });

  it("uses a plain cookie for a local http production preview", () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3010";
    try {
      const session = createSession(TEST_SESSION_INPUT);
      expect(sessionCookieName(true)).toBe("tessera_session");
      expect(sessionCookieOptions(session, true).secure).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = previous;
    }
  });
});

const TEST_DISTRICT_BASE_URL = "https://hac.example.edu";
