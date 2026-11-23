import { NextResponse, type NextRequest } from "next/server";
import { handleApi, providerJson } from "@/lib/api/route";
import { guardData } from "@/lib/api/guards";
import { getProvider } from "@/lib/providers";
import { readSession } from "@/lib/session/current";
import { InvalidInputProblem } from "@/lib/security/errors";
import { AttendanceQuerySchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleApi(async () => {
    const session = readSession(request);
    guardData(request, session);

    const raw = request.nextUrl.searchParams.get("month") ?? undefined;
    const parsed = AttendanceQuerySchema.safeParse({ month: raw });
    if (!parsed.success) {
      throw new InvalidInputProblem(
        parsed.error.issues[0]?.message ?? "Use a month in YYYY-MM form.",
      );
    }

    const result = await getProvider(session).getAttendance(parsed.data.month ?? null);
    return providerJson(session, result);
  });
}
