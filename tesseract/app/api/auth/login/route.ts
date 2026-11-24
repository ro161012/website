import { NextResponse, type NextRequest } from "next/server";
import { InvalidInputProblem } from "@/lib/security/errors";
import {
  assertJsonRequest,
  assertSameOrigin,
  readJsonBody,
} from "@/lib/security/request";
import { guardLogin } from "@/lib/api/guards";
import { apiJson, handleApi } from "@/lib/api/route";
import { getHacDistrictUrl } from "@/lib/config/hac";
import { loginToHac } from "@/lib/hac/auth";
import { applySessionCookie, clearLogoutCookie } from "@/lib/session/current";
import { createSession } from "@/lib/session/crypto";
import { LoginRequestSchema, type LoginResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleApi(async () => {
    assertSameOrigin(request);
    assertJsonRequest(request);

    const body = await readJsonBody(request);
    const parsed = LoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidInputProblem(
        parsed.error.issues[0]?.message ?? "Check the sign-in details.",
      );
    }

    guardLogin(request, parsed.data.username);
    const login = await loginToHac({
      ...parsed.data,
      districtUrl: parsed.data.districtUrl ?? getHacDistrictUrl(),
      districtId: parsed.data.districtId,
    });

    if (login.status === "mfa_required") {
      const payload: LoginResult = { status: "mfa_required" };
      return apiJson(payload, login.warnings);
    }

    const session = createSession({
      mode: "hac",
      district: login.district,
      cookies: login.cookies,
      students: login.students,
      activeStudentId: login.student.id,
    });

    const payload: LoginResult = {
      status: "authenticated",
      student: login.student,
      students: login.students,
      district: login.district,
    };
    const response = apiJson(payload, login.warnings);
    applySessionCookie(response, session);
    clearLogoutCookie(response);
    return response;
  });
}
