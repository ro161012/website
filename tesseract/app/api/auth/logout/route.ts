import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/security/request";
import { apiJson, handleApi } from "@/lib/api/route";
import { clearSessionCookie } from "@/lib/session/current";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleApi(async () => {
    assertSameOrigin(request);
    const response = apiJson({ ok: true as const });
    clearSessionCookie(response);
    return response;
  });
}
