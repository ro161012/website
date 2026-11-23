import { NextResponse, type NextRequest } from "next/server";
import { handleApi, providerJson } from "@/lib/api/route";
import { guardData } from "@/lib/api/guards";
import { getProvider } from "@/lib/providers";
import { readSession } from "@/lib/session/current";
import { InvalidInputProblem } from "@/lib/security/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleApi(async () => {
    const session = readSession(request);
    guardData(request, session);

    const raw = request.nextUrl.searchParams.get("days");
    const days = raw === null ? 14 : Number(raw);
    if (!Number.isInteger(days) || days < 1 || days > 60) {
      throw new InvalidInputProblem("Days must be a whole number between 1 and 60.");
    }

    const result = await getProvider(session).getUpcomingAssignments(days);
    return providerJson(session, result);
  });
}
