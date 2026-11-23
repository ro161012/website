import { httpStatusForError } from "@/lib/api/envelope";
import type { ApiErrorCode } from "@/lib/types";

export class ApiProblem extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message: string,
    status: number = httpStatusForError(code),
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiProblem";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class InvalidInputProblem extends ApiProblem {
  constructor(message = "Check the submitted values and try again.") {
    super("invalid_input", message);
    this.name = "InvalidInputProblem";
  }
}

export class InvalidDistrictInputProblem extends ApiProblem {
  constructor(message = "Enter the complete HTTPS address of your district's HAC.") {
    super("invalid_input", message);
    this.name = "InvalidDistrictInputProblem";
  }
}

export class InvalidCredentialsProblem extends ApiProblem {
  constructor() {
    super("invalid_credentials", "The district did not accept that username or password.");
    this.name = "InvalidCredentialsProblem";
  }
}

export class UnauthorizedProblem extends ApiProblem {
  constructor(message = "Sign in to continue.") {
    super("unauthorized", message);
    this.name = "UnauthorizedProblem";
  }
}

export class SessionExpiredProblem extends ApiProblem {
  constructor() {
    super("session_expired", "Your HAC session expired. Sign in again to continue.");
    this.name = "SessionExpiredProblem";
  }
}

export class ForbiddenProblem extends ApiProblem {
  constructor(message = "This request was blocked.") {
    super("forbidden", message, 403);
    this.name = "ForbiddenProblem";
  }
}

export class ForbiddenHostProblem extends ApiProblem {
  constructor(message = "Tesseract cannot connect to that district host.") {
    super("forbidden_host", message, 400);
    this.name = "ForbiddenHostProblem";
  }
}

export class RateLimitedProblem extends ApiProblem {
  constructor(retryAfterSeconds: number) {
    super("rate_limited", "Too many requests. Wait a moment and try again.", 429, {
      retryAfterSeconds,
    });
    this.name = "RateLimitedProblem";
  }
}

export class UpstreamProblem extends ApiProblem {
  constructor(message = "The district HAC could not be reached. Try again shortly.") {
    super("upstream_unavailable", message, 502);
    this.name = "UpstreamProblem";
  }
}

export class UpstreamTimeoutProblem extends ApiProblem {
  constructor() {
    super("upstream_timeout", "The district HAC took too long to respond.", 504);
    this.name = "UpstreamTimeoutProblem";
  }
}

export class ParseProblem extends ApiProblem {
  constructor(message = "HAC returned a page Tesseract could not read. The district profile may need an update.") {
    super("parse_failed", message, 502);
    this.name = "ParseProblem";
  }
}

export class NotFoundProblem extends ApiProblem {
  constructor(message = "That item was not found.") {
    super("not_found", message, 404);
    this.name = "NotFoundProblem";
  }
}

export class ConfigurationProblem extends ApiProblem {
  constructor(message = "Tesseract is not configured correctly.") {
    super("configuration_error", message, 500);
    this.name = "ConfigurationProblem";
  }
}

export class SessionTooLargeProblem extends ConfigurationProblem {
  constructor() {
    super("This HAC session is too large to store securely. Contact the operator.");
    this.name = "SessionTooLargeProblem";
  }
}
