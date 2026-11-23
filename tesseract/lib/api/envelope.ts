import type {
  ApiError,
  ApiErrorCode,
  ApiFailure,
  ApiSuccess,
  IsoDateTime,
  Warning,
} from "@/lib/types";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  invalid_input: 400,
  invalid_credentials: 401,
  unauthorized: 401,
  session_expired: 401,
  forbidden: 403,
  forbidden_host: 400,
  rate_limited: 429,
  upstream_unavailable: 502,
  upstream_timeout: 504,
  parse_failed: 502,
  not_found: 404,
  configuration_error: 500,
  internal_error: 500,
};

export function apiSuccess<T>(
  data: T,
  warnings: readonly Warning[] = [],
  fetchedAt: IsoDateTime = new Date().toISOString(),
): ApiSuccess<T> {
  return { data, warnings: [...warnings], fetchedAt };
}

export function apiFailure(
  code: ApiErrorCode,
  message: string,
  details?: ApiError["details"],
): ApiFailure {
  const error: ApiError = details ? { code, message, details } : { code, message };
  return { error };
}

export function httpStatusForError(code: ApiErrorCode): number {
  return STATUS_BY_CODE[code];
}

export function isApiSuccess<T>(body: ApiSuccess<T> | ApiFailure): body is ApiSuccess<T> {
  return "data" in body;
}
