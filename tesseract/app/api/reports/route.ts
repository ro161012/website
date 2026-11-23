import { NextResponse, type NextRequest } from "next/server";
import { handleApi, providerJson } from "@/lib/api/route";
import { guardData } from "@/lib/api/guards";
import { getProvider } from "@/lib/providers";
import { readSession } from "@/lib/session/current";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleApi(async () => {
    const session = readSession(request);
    guardData(request, session);
    const result = await getProvider(session).getReports();
    return providerJson(session, result);
  });
}
