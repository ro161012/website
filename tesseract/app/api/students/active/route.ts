import { NextResponse, type NextRequest } from "next/server";
import { handleApi, sessionJson } from "@/lib/api/route";
import { guardData } from "@/lib/api/guards";
import { getProvider } from "@/lib/providers";
import { InvalidInputProblem, NotFoundProblem } from "@/lib/security/errors";
import {
  assertJsonRequest,
  assertSameOrigin,
  readJsonBody,
} from "@/lib/security/request";
import { readSession } from "@/lib/session/current";
import { SelectStudentRequestSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleApi(async () => {
    assertSameOrigin(request);
    assertJsonRequest(request);

    const session = readSession(request);
    guardData(request, session);

    const body = await readJsonBody(request);
    const parsed = SelectStudentRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidInputProblem(
        parsed.error.issues[0]?.message ?? "Choose a student from this session.",
      );
    }

    const target = session.students.find(
      (student) => student.id === parsed.data.studentId,
    );
    if (!target) throw new NotFoundProblem("That student is not in this session.");

    if (target.id === session.activeStudentId) {
      return sessionJson(session, target);
    }

    const provider = getProvider(session);
    if (!provider.switchStudent) {
      throw new NotFoundProblem(
        "This district does not expose a student switcher. Sign in again with the other student.",
      );
    }

    const switched = await provider.switchStudent(target.id);
    const updatedSession = {
      ...session,
      activeStudentId: target.id,
      cookies: switched.cookies ?? session.cookies,
    };
    return sessionJson(
      updatedSession,
      switched.data,
      switched.warnings,
      updatedSession.cookies,
    );
  });
}
