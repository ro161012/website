import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodeResponseBody } from "@/lib/hac/http";

describe("HAC response decoding", () => {
  it("decompresses gzip responses", () => {
    const compressed = gzipSync(Buffer.from("<html>grades</html>"));
    expect(decodeResponseBody(compressed, "gzip").toString()).toBe(
      "<html>grades</html>",
    );
  });

  it("caps decompressed output so a compressed page cannot exhaust memory", () => {
    const compressed = gzipSync(Buffer.alloc(4_096, "a"));
    expect(() => decodeResponseBody(compressed, "gzip", 32)).toThrow(
      /compressed content/i,
    );
  });
});
