import { hashToken } from "@/lib/security/request";
import type { Session } from "@/lib/session/schema";

const TTL_MS = 60_000;
const MAX_ENTRIES = 400;

interface Entry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();
/** In-flight loads share one upstream request instead of racing each other. */
const pending = new Map<string, Promise<unknown>>();

function prune(now: number): void {
  if (store.size < MAX_ENTRIES) return;
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value as string | undefined;
    if (!oldest) break;
    store.delete(oldest);
  }
}

export function providerCacheKey(session: Session, suffix: string): string {
  const scope = hashToken(
    JSON.stringify({
      mode: session.mode,
      district: session.district.id,
      student: session.activeStudentId,
      issuedAt: session.issuedAt,
      cookies: hashToken(JSON.stringify(session.cookies)).slice(0, 16),
    }),
  );
  return `${scope}:${suffix}`;
}

export async function cached<T>(
  key: string,
  load: () => Promise<T>,
  now = Date.now(),
): Promise<T> {
  const existing = store.get(key);
  if (existing && existing.expiresAt > now) return existing.value as T;

  const inFlight = pending.get(key);
  if (inFlight) return inFlight as Promise<T>;

  const promise = load()
    .then((value) => {
      prune(Date.now());
      store.set(key, { value, expiresAt: Date.now() + TTL_MS });
      return value;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, promise);
  return promise;
}

export function clearProviderCache(): void {
  store.clear();
  pending.clear();
}
