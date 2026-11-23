import { NextResponse, type NextRequest } from "next/server";
import { apiJson, handleApi } from "@/lib/api/route";
import { guardData } from "@/lib/api/guards";
import { readSession } from "@/lib/session/current";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleApi(async () => {
    const session = readSession(request);
    guardData(request, session);
    return apiJson(session.students);
  });
}
