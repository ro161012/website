import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import {
  SessionSchema,
  SESSION_MAX_JSON_BYTES,
  SESSION_TTL_MS,
  type Session,
  type SessionInput,
} from "./schema";
import {
  ConfigurationProblem,
  SessionExpiredProblem,
  SessionTooLargeProblem,
  UnauthorizedProblem,
} from "@/lib/security/errors";

const TOKEN_PREFIX = "v1.";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const AAD = Buffer.from("tessera-session-v1", "utf8");
const HKDF_SALT = Buffer.from("tessera", "utf8");
const HKDF_INFO = Buffer.from("session-cookie-v1", "utf8");
const MIN_SECRET_BYTES = 32;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

function readSecret(secret?: string): string {
  const value = secret ?? process.env.SESSION_SECRET;
  if (!value || Buffer.byteLength(value, "utf8") < MIN_SECRET_BYTES) {
    throw new ConfigurationProblem(
      "SESSION_SECRET must be set to at least 32 bytes before signing in.",
    );
  }
  return value;
}

export function deriveSessionKey(secret?: string): Buffer {
  const key = hkdfSync(
    "sha256",
    Buffer.from(readSecret(secret), "utf8"),
    HKDF_SALT,
    HKDF_INFO,
    32,
  );
  return Buffer.from(key);
}

export function createSession(input: SessionInput, now = Date.now()): Session {
  return SessionSchema.parse({
    ...input,
    v: 1,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
}

export function sealSession(session: Session, secret?: string): string {
  const validated = SessionSchema.parse(session);
  const plaintext = Buffer.from(JSON.stringify(validated), "utf8");

  if (plaintext.byteLength > SESSION_MAX_JSON_BYTES) {
    throw new SessionTooLargeProblem();
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveSessionKey(secret), iv, {
    authTagLength: TAG_BYTES,
  });
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${TOKEN_PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}

export function openSession(
  token: string,
  secret?: string,
  now = Date.now(),
): Session {
  if (!token.startsWith(TOKEN_PREFIX)) {
    throw new UnauthorizedProblem();
  }

  let packed: Buffer;
  try {
    packed = Buffer.from(token.slice(TOKEN_PREFIX.length), "base64url");
  } catch {
    throw new UnauthorizedProblem();
  }

  if (packed.byteLength < IV_BYTES + TAG_BYTES + 2) {
    throw new UnauthorizedProblem();
  }

  const iv = packed.subarray(0, IV_BYTES);
  const tag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = packed.subarray(IV_BYTES + TAG_BYTES);

  let plaintext: string;
  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveSessionKey(secret), iv, {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new UnauthorizedProblem();
  }

  let session: Session;
  try {
    session = SessionSchema.parse(JSON.parse(plaintext) as unknown);
  } catch {
    throw new UnauthorizedProblem();
  }

  if (session.expiresAt <= now) {
    throw new SessionExpiredProblem();
  }

  if (session.issuedAt > now + CLOCK_SKEW_MS) {
    throw new UnauthorizedProblem();
  }

  return session;
}

/**
 * `__Host-` and `Secure` require an HTTPS deployment. A local production
 * build (`next start` on http://localhost) is still a secure context for the
 * browser, but Chromium rejects Secure cookies set over an http scheme. Use
 * the deployment origin when it is declared; otherwise fall back to the
 * production default, which is HTTPS on Vercel.
 */
export function sessionCookieSecure(
  production = process.env.NODE_ENV === "production",
): boolean {
  if (!production) return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return true;
  try {
    return new URL(appUrl).protocol === "https:";
  } catch {
    return true;
  }
}

export function sessionCookieName(
  production = process.env.NODE_ENV === "production",
  secure = sessionCookieSecure(production),
): string {
  return secure ? "__Host-tessera_session" : "tessera_session";
}

/** Short-lived marker that prevents an in-flight response from resurrecting a
 * session after sign-out. */
export function logoutCookieName(
  production = process.env.NODE_ENV === "production",
  secure = sessionCookieSecure(production),
): string {
  return secure ? "__Host-tessera_logged_out" : "tessera_logged_out";
}

export interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict";
  path: string;
  expires: Date;
  maxAge: number;
}

export function sessionCookieOptions(
  session: Session,
  production = process.env.NODE_ENV === "production",
  now = Date.now(),
): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: sessionCookieSecure(production),
    sameSite: "strict",
    path: "/",
    expires: new Date(session.expiresAt),
    maxAge: Math.max(0, Math.floor((session.expiresAt - now) / 1000)),
  };
}
