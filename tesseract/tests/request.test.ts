import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenProblem } from "@/lib/security/errors";
import { assertSameOrigin } from "@/lib/security/request";

function request(
  url: string,
  headers: Record<string, string>,
): NextRequest {
  return new NextRequest(url, { method: "POST", headers });
}

describe("same-origin guard", () => {
  it("accepts the browser's same-origin assertion when the framework rewrites the URL host", () => {
    const candidate = request("http://localhost:3100/api/auth/logout", {
      host: "127.0.0.1:3100",
      origin: "http://127.0.0.1:3100",
      "sec-fetch-site": "same-origin",
    });

    expect(() => assertSameOrigin(candidate)).not.toThrow();
  });

  it("accepts a matching Origin when Fetch Metadata is absent", () => {
    const candidate = request("http://localhost:3100/api/students/active", {
      host: "127.0.0.1:3100",
      origin: "http://127.0.0.1:3100",
    });

    expect(() => assertSameOrigin(candidate)).not.toThrow();
  });

  it("rejects a cross-site browser request", () => {
    const candidate = request("http://localhost:3100/api/auth/logout", {
      host: "127.0.0.1:3100",
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    });

    expect(() => assertSameOrigin(candidate)).toThrow(ForbiddenProblem);
  });

  it("rejects a foreign Origin without Fetch Metadata", () => {
    const candidate = request("http://localhost:3100/api/auth/logout", {
      host: "127.0.0.1:3100",
      origin: "https://evil.example",
    });

    expect(() => assertSameOrigin(candidate)).toThrow(ForbiddenProblem);
  });

  it("allows non-browser requests that carry no Origin", () => {
    const candidate = request("http://localhost:3100/api/auth/logout", {
      host: "127.0.0.1:3100",
    });

    expect(() => assertSameOrigin(candidate)).not.toThrow();
  });
});
