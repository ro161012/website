import type { StoredCookie } from "@/lib/session/schema";

const MAX_COOKIES = 40;
const MAX_VALUE_BYTES = 3_000;

function defaultPath(pathname: string): string {
  if (!pathname.startsWith("/")) return "/";
  const lastSlash = pathname.lastIndexOf("/");
  return lastSlash <= 0 ? "/" : pathname.slice(0, lastSlash);
}

function pathMatches(cookiePath: string, requestPath: string): boolean {
  if (cookiePath === "/") return true;
  return requestPath === cookiePath || requestPath.startsWith(`${cookiePath}/`);
}

function domainMatches(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const cookieDomain = domain.toLowerCase().replace(/^\./, "").replace(/\.$/, "");
  return host === cookieDomain || host.endsWith(`.${cookieDomain}`);
}

function cleanup(cookies: StoredCookie[], now: number): StoredCookie[] {
  return cookies.filter(
    (cookie) => cookie.expiresAt === null || cookie.expiresAt > now,
  );
}

/**
 * Parse a Set-Cookie header. Only the first name=value pair and the standard
 * attributes that affect sending are retained; SameSite/Partitioned are not
 * needed by the server-side jar.
 */
export function parseSetCookie(
  line: string,
  requestUrl: URL,
  now = Date.now(),
): StoredCookie | null {
  const parts = line.split(";");
  const pair = parts.shift()?.trim() ?? "";
  const equals = pair.indexOf("=");
  if (equals <= 0) return null;

  const name = pair.slice(0, equals).trim();
  let value = pair.slice(equals + 1).trim();
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    value = value.slice(1, -1);
  }

  if (!name || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)) return null;
  if (/[\r\n\0]/.test(value)) return null;
  if (Buffer.byteLength(value, "utf8") > MAX_VALUE_BYTES) return null;

  const hostname = requestUrl.hostname.toLowerCase().replace(/\.$/, "");
  let domain = hostname;
  let path = defaultPath(requestUrl.pathname);
  let secure = false;
  let httpOnly = false;
  let expiresAt: number | null = null;

  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    const key = rawKey?.toLowerCase();
    const attrValue = rawValue.join("=").trim();

    if (key === "domain" && attrValue) {
      const candidate = attrValue.replace(/^\./, "").toLowerCase();
      if (domainMatches(hostname, candidate)) domain = candidate;
    } else if (key === "path" && attrValue.startsWith("/")) {
      path = attrValue;
    } else if (key === "secure") {
      secure = true;
    } else if (key === "httponly") {
      httpOnly = true;
    } else if (key === "max-age") {
      const seconds = Number(attrValue);
      if (Number.isFinite(seconds)) expiresAt = now + seconds * 1000;
    } else if (key === "expires") {
      const parsed = Date.parse(attrValue);
      if (!Number.isNaN(parsed)) expiresAt = parsed;
    }
  }

  return { name, value, domain, path, secure, httpOnly, expiresAt };
}

export class CookieJar {
  private cookies: StoredCookie[];

  constructor(cookies: StoredCookie[] = []) {
    this.cookies = cleanup(structuredClone(cookies), Date.now());
  }

  static fromJson(cookies: StoredCookie[]): CookieJar {
    return new CookieJar(cookies);
  }

  toJson(): StoredCookie[] {
    return structuredClone(cleanup(this.cookies, Date.now()));
  }

  headerFor(url: URL): string {
    const now = Date.now();
    this.cookies = cleanup(this.cookies, now);

    return this.cookies
      .filter(
        (cookie) =>
          domainMatches(url.hostname, cookie.domain) &&
          pathMatches(cookie.path, url.pathname) &&
          (!cookie.secure || url.protocol === "https:"),
      )
      .sort((a, b) => b.path.length - a.path.length)
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
  }

  addFromResponse(
    setCookie: string[] | undefined,
    requestUrl: URL,
    now = Date.now(),
  ): void {
    if (!setCookie?.length) return;

    for (const line of setCookie) {
      const parsed = parseSetCookie(line, requestUrl, now);
      if (!parsed) continue;

      this.cookies = this.cookies.filter(
        (cookie) =>
          !(
            cookie.name === parsed.name &&
            cookie.domain === parsed.domain &&
            cookie.path === parsed.path
          ),
      );

      if (parsed.expiresAt !== null && parsed.expiresAt <= now) continue;

      this.cookies.push(parsed);
    }

    if (this.cookies.length > MAX_COOKIES) {
      this.cookies = this.cookies.slice(-MAX_COOKIES);
    }
  }
}
