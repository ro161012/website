import { z } from "zod";

/** Calendar date in ISO form (`YYYY-MM-DD`). HAC dates carry no timezone. */
export const IsoDateSchema = z.iso.date();
export type IsoDate = z.infer<typeof IsoDateSchema>;

/** Absolute timestamp in ISO 8601 form. Server timestamps are always UTC. */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

/** Stable, opaque identifier. The client never parses an id. */
export const OpaqueIdSchema = z.string().min(1).max(128);
export type OpaqueId = z.infer<typeof OpaqueIdSchema>;

/**
 * A district URL must be absolute, HTTPS, and free of credentials, query
 * strings and fragments. Credentials belong in a POST body only.
 */
export const HttpsUrlSchema = z
  .url()
  .refine((value) => value.startsWith("https://"), {
    message: "Only HTTPS URLs are allowed.",
  })
  .refine((value) => {
    const url = new URL(value);
    return url.username === "" && url.password === "";
  }, {
    message: "Remove the username and password from the district URL.",
  })
  .refine((value) => {
    const url = new URL(value);
    return url.search === "" && url.hash === "";
  }, {
    message: "A district URL cannot contain a query string or fragment.",
  });
export type HttpsUrl = z.infer<typeof HttpsUrlSchema>;

/**
 * A non-fatal parser or adapter problem. The API still returns data; the UI
 * can surface warnings without replacing the screen with an error state.
 */
export const WarningSchema = z.strictObject({
  code: z.string().min(1).max(80),
  message: z.string().min(1).max(500),
  path: z.string().min(1).max(240).optional(),
});
export type Warning = z.infer<typeof WarningSchema>;

export const API_ERROR_CODES = [
  "invalid_input",
  "invalid_credentials",
  "unauthorized",
  "session_expired",
  "forbidden",
  "forbidden_host",
  "rate_limited",
  "upstream_unavailable",
  "upstream_timeout",
  "parse_failed",
  "not_found",
  "configuration_error",
  "internal_error",
] as const;

export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.strictObject({
  code: ApiErrorCodeSchema,
  message: z.string().min(1).max(500),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export interface ApiSuccess<T> {
  data: T;
  warnings: Warning[];
  fetchedAt: IsoDateTime;
}

export interface ApiFailure {
  error: ApiError;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

/** Build a success-envelope schema around a data schema. */
export function apiSuccessSchema<T extends z.ZodType>(data: T) {
  return z.strictObject({
    data,
    warnings: z.array(WarningSchema),
    fetchedAt: IsoDateTimeSchema,
  });
}
