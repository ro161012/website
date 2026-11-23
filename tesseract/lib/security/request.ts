import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { NextRequest } from "next/server";
import {
  ForbiddenProblem,
  InvalidInputProblem,
} from "./errors";

/** Best-effort client IP. Vercel sets x-forwarded-for; local requests fall back. */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const candidate =
    forwarded?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "";

  return candidate && isIP(candidate) !== 0 ? candidate : "unknown";
}

function addOrigin(set: Set<string>, value: string | null | undefined): void {
  if (!value) return;
  try {
    set.add(new URL(value).origin);
  } catch {
    // Ignore malformed header values; the comparison simply fails.
  }
}

/**
 * SameSite=Strict is the primary CSRF defense. This also rejects explicit
 * cross-site browser requests and a foreign Origin header.
 */
export function assertSameOrigin(request: NextRequest): void {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new ForbiddenProblem();
  }

  // Page script cannot set Sec-Fetch-Site, so the browser's own assertion is
  // authoritative. It also survives framework/proxy URL canonicalization that
  // can make request.url disagree with the host in the address bar.
  if (fetchSite === "same-origin" || fetchSite === "none") return;

  const origin = request.headers.get("origin");
  if (!origin) return;

  // Do not trust x-forwarded-* here: a client or permissive proxy can set
  // those headers and turn an origin check into a bypass. The deployment's
  // public origin belongs in NEXT_PUBLIC_APP_URL.
  const allowed = new Set<string>();
  addOrigin(allowed, request.url);
  addOrigin(allowed, process.env.NEXT_PUBLIC_APP_URL);

  // Older browsers may omit Fetch Metadata. request.url can carry a
  // canonicalized host (for example localhost while the user opened
  // 127.0.0.1), so also compare against the Host header of this request.
  const host = request.headers.get("host");
  if (host) {
    addOrigin(allowed, `http://${host}`);
    addOrigin(allowed, `https://${host}`);
  }

  let supplied: string;
  try {
    supplied = new URL(origin).origin;
  } catch {
    throw new ForbiddenProblem();
  }

  if (!allowed.has(supplied)) {
    throw new ForbiddenProblem();
  }
}

export function assertJsonRequest(request: NextRequest): void {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new InvalidInputProblem("Send JSON with Content-Type: application/json.");
  }
}

export async function readJsonBody(
  request: NextRequest,
  maxBytes = 16_384,
): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new InvalidInputProblem("The request body is too large.");
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new InvalidInputProblem("The request body is too large.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InvalidInputProblem("The request body is not valid JSON.");
  }
}

/** Short stable hash used for cache/rate-limit keys; never logged. */
export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("base64url").slice(0, 32);
}
