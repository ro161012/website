import type { Warning } from "@/lib/types";

export class SessionLostError extends Error {
  constructor() {
    super("Your session ended.");
    this.name = "SessionLostError";
  }
}

export interface ApiEnvelope<T> {
  data?: T;
  warnings?: Warning[];
  fetchedAt?: string;
  error?: { code?: string; message?: string };
}

export async function apiGet<T>(
  url: string,
  signal?: AbortSignal,
): Promise<{ data: T; warnings: Warning[]; fetchedAt: string }> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    body = null;
  }

  if (
    response.status === 401 ||
    body?.error?.code === "unauthorized" ||
    body?.error?.code === "session_expired"
  ) {
    throw new SessionLostError();
  }

  if (!response.ok || !body || body.data === undefined) {
    throw new Error(
      body?.error?.message ?? "Tesseract could not load that part of your record.",
    );
  }

  return {
    data: body.data,
    warnings: body.warnings ?? [],
    fetchedAt: body.fetchedAt ?? new Date().toISOString(),
  };
}

export function errorMessage(problem: unknown): string {
  return problem instanceof Error
    ? problem.message
    : "Something went wrong. Try again.";
}
