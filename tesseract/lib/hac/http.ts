import * as https from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import type { LookupFunction } from "node:net";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import type { DistrictProfile } from "@/lib/hac/profiles";
import { CookieJar } from "./cookies";
import {
  assertRedirectHostAllowed,
  resolveRequestTarget,
  type ResolvedAddress,
  type ResolvedTarget,
} from "./url";
import {
  ForbiddenHostProblem,
  ParseProblem,
  UpstreamProblem,
  UpstreamTimeoutProblem,
} from "@/lib/security/errors";

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 6;

export interface FetchHacOptions {
  url: URL;
  jar: CookieJar;
  profile: DistrictProfile;
  method?: "GET" | "POST";
  form?: Record<string, string>;
  referer?: URL;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface HacResponse {
  status: number;
  finalUrl: URL;
  headers: IncomingHttpHeaders;
  html: string;
}

interface RawResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

/** Pin the validated DNS answer so Node cannot resolve the host a second time. */
export function makePinnedLookup(addresses: ResolvedAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    const family =
      options.family === 4 || options.family === 6 ? options.family : undefined;
    const chosen =
      addresses.find((address) => !family || address.family === family) ??
      addresses[0];

    if (!chosen) {
      const error = Object.assign(new Error("No validated address"), {
        code: "ENOTFOUND",
      });
      if (options.all) callback(error, []);
      else callback(error, "");
      return;
    }

    if (options.all) {
      callback(null, [{ address: chosen.address, family: chosen.family }]);
      return;
    }

    callback(null, chosen.address, chosen.family);
  };
}

export function decodeResponseBody(
  body: Buffer,
  encoding: string | undefined,
  maxBytes = DEFAULT_MAX_BYTES,
): Buffer {
  const value = encoding?.trim().toLowerCase();
  if (!value || value === "identity") return body;
  try {
    const options = { maxOutputLength: maxBytes };
    if (value === "gzip" || value === "x-gzip") return gunzipSync(body, options);
    if (value === "deflate") return inflateSync(body, options);
    if (value === "br") return brotliDecompressSync(body, options);
  } catch {
    throw new UpstreamProblem("The district HAC returned compressed content Tesseract could not read.");
  }
  return body;
}

export function decodeHtml(buffer: Buffer, contentType: string | undefined): string {
  const match = /charset\s*=\s*"?([^";\s]+)/i.exec(contentType ?? "");
  const label = match?.[1] ?? "utf-8";
  try {
    return new TextDecoder(label).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function rawRequest(
  target: ResolvedTarget,
  method: "GET" | "POST",
  headers: Record<string, string>,
  body: Buffer | undefined,
  timeoutMs: number,
  maxBytes: number,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let tooLarge = false;

    const finish = (error: Error | null, response?: RawResponse): void => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else if (response) resolve(response);
      else reject(new UpstreamProblem());
    };

    const req = https.request(
      target.url,
      {
        method,
        headers,
        lookup: makePinnedLookup(target.addresses),
        agent: false,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;

        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            tooLarge = true;
            res.destroy();
            req.destroy();
            finish(new UpstreamProblem("The district HAC returned an unexpectedly large page."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("error", () => {
          if (!tooLarge) finish(new UpstreamProblem());
        });
        res.on("end", () => {
          finish(null, {
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );

    req.on("timeout", () => {
      timedOut = true;
      req.destroy();
    });
    req.on("error", () => {
      finish(
        timedOut
          ? new UpstreamTimeoutProblem()
          : new UpstreamProblem(),
      );
    });

    if (body) req.write(body);
    req.end();
  });
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function contentTypeAllowed(contentType: string | undefined): boolean {
  if (!contentType) return true;
  const mime = contentType.split(";")[0]?.trim().toLowerCase();
  return mime === "text/html" || mime === "application/xhtml+xml";
}

export async function fetchHacPage(options: FetchHacOptions): Promise<HacResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const initialHost = options.url.hostname.toLowerCase();
  const ssoSuffixes = options.profile.quirks?.ssoHostSuffixes ?? [];

  let target = await resolveRequestTarget(options.url);
  let method = options.method ?? "GET";
  let body =
    method === "POST" && options.form
      ? Buffer.from(new URLSearchParams(options.form).toString(), "utf8")
      : undefined;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const headers: Record<string, string> = {
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "User-Agent":
        options.profile.quirks?.userAgent ??
        "Tesseract/0.2 (+student grade viewer)",
      Connection: "close",
    };

    const cookieHeader = options.jar.headerFor(target.url);
    if (cookieHeader) headers.Cookie = cookieHeader;
    if (options.referer) headers.Referer = options.referer.toString();

    if (method === "POST") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      headers["Content-Length"] = String(body?.byteLength ?? 0);
      headers.Origin = target.url.origin;
    }

    const response = await rawRequest(
      target,
      method,
      headers,
      body,
      timeoutMs,
      maxBytes,
    );

    options.jar.addFromResponse(response.headers["set-cookie"], target.url);

    if (isRedirect(response.status)) {
      const location = response.headers.location;
      if (!location) {
        throw new UpstreamProblem("The district HAC sent a redirect without a location.");
      }

      let next: URL;
      try {
        next = new URL(location, target.url);
      } catch {
        throw new UpstreamProblem("The district HAC sent an invalid redirect.");
      }

      assertRedirectHostAllowed(next.hostname, initialHost, ssoSuffixes);

      const preserveMethod = response.status === 307 || response.status === 308;
      if (preserveMethod && method === "POST" && next.hostname.toLowerCase() !== initialHost) {
        throw new ForbiddenHostProblem(
          "HAC tried to forward a form submission to another host.",
        );
      }

      target = await resolveRequestTarget(next);
      if (!preserveMethod) {
        method = "GET";
        body = undefined;
      }
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new UpstreamProblem(
        `The district HAC returned HTTP ${response.status}. Try again shortly.`,
      );
    }

    if (!contentTypeAllowed(response.headers["content-type"])) {
      throw new ParseProblem("The district HAC returned something other than a web page.");
    }

    const decoded = decodeResponseBody(
      response.body,
      response.headers["content-encoding"],
      maxBytes,
    );
    if (decoded.byteLength > maxBytes) {
      throw new UpstreamProblem("The district HAC returned an unexpectedly large page.");
    }

    return {
      status: response.status,
      finalUrl: target.url,
      headers: response.headers,
      html: decodeHtml(decoded, response.headers["content-type"]),
    };
  }

  throw new UpstreamProblem("The district HAC redirected too many times.");
}
