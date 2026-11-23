import { NextResponse, type NextRequest } from "next/server";
import { handleApi, providerJson } from "@/lib/api/route";
import { guardData } from "@/lib/api/guards";
import { getProvider } from "@/lib/providers";
import { readSession } from "@/lib/session/current";
import { InvalidInputProblem } from "@/lib/security/errors";
import { OpaqueIdSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  return handleApi(async () => {
    const session = readSession(request);
    guardData(request, session);

    const { id } = await context.params;
    if (!OpaqueIdSchema.safeParse(id).success) {
      throw new InvalidInputProblem("That course id is not valid.");
    }

    const rawMp = request.nextUrl.searchParams.get("mp") ?? null;
    if (rawMp !== null && !OpaqueIdSchema.safeParse(rawMp).success) {
      throw new InvalidInputProblem("Choose a valid marking period.");
    }

    const result = await getProvider(session).getCourse(id, rawMp);
    return providerJson(session, result);
  });
}
