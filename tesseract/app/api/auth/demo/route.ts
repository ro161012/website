import { NextResponse, type NextRequest } from "next/server";
import { guardDemo } from "@/lib/api/guards";
import { demoSessionInput } from "@/lib/demo/session";
import { applySessionCookie } from "@/lib/session/current";
import { createSession } from "@/lib/session/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo entry is a GET because it is a top-level navigation target. It creates
 * only the encrypted demo session — no HAC cookies, no credentials, no grades.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    guardDemo(request);
  } catch {
    return NextResponse.redirect(new URL("/?demo=limited", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  applySessionCookie(response, createSession(demoSessionInput()));
  return response;
}
