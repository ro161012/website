import { describe, expect, it } from "vitest";
import { apiFailure, apiSuccess, httpStatusForError } from "@/lib/api/envelope";
import { SITE } from "@/lib/config/site";
import {
  API_ERROR_CODES,
  LoginResponseSchema,
  LoginResultSchema,
  MeDataSchema,
} from "@/lib/types";
import { TEST_DISTRICT, TEST_STUDENT } from "./fixtures/model";

describe("product contract", () => {
  it("keeps the exact legal notice", () => {
    expect(SITE.legalNotice).toBe(
      "Independent app. Not affiliated with or endorsed by PowerSchool or any school district. Home Access Center is a trademark of PowerSchool. Use only with your own account and follow your school's acceptable-use policy.",
    );
  });

  it("maps every API error code to a safe HTTP status", () => {
    for (const code of API_ERROR_CODES) {
      expect(httpStatusForError(code)).toBeGreaterThanOrEqual(400);
      expect(httpStatusForError(code)).toBeLessThan(600);
    }
    expect(httpStatusForError("forbidden")).toBe(403);
    expect(httpStatusForError("forbidden_host")).toBe(400);
    expect(httpStatusForError("rate_limited")).toBe(429);
  });

  it("wraps data with warnings and an ISO timestamp", () => {
    const envelope = apiSuccess({ ok: true });
    expect(envelope).toMatchObject({
      data: { ok: true },
      warnings: [],
    });
    expect(Date.parse(envelope.fetchedAt)).not.toBeNaN();
    expect(apiFailure("unauthorized", "Sign in.")).toEqual({
      error: { code: "unauthorized", message: "Sign in." },
    });
  });

  it("accepts a login response and a me payload", () => {
    const login = apiSuccess({
      status: "authenticated" as const,
      student: TEST_STUDENT,
      students: [TEST_STUDENT],
      district: TEST_DISTRICT,
    });
    expect(LoginResponseSchema.safeParse(login).success).toBe(true);

    expect(
      LoginResultSchema.safeParse({
        status: "mfa_required",
      }).success,
    ).toBe(true);

    expect(
      MeDataSchema.safeParse({
        mode: "hac",
        student: TEST_STUDENT,
        students: [TEST_STUDENT],
        district: TEST_DISTRICT,
        markingPeriods: [],
        activeMarkingPeriodId: null,
      }).success,
    ).toBe(true);
  });

  it("rejects a malformed login status", () => {
    const login = apiSuccess({
      status: "signed_in",
      student: TEST_STUDENT,
      students: [TEST_STUDENT],
      district: TEST_DISTRICT,
    });
    expect(LoginResponseSchema.safeParse(login).success).toBe(false);
  });
});
