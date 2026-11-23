import { describe, expect, it } from "vitest";
import {
  assertRedirectHostAllowed,
  isBlockedHostname,
  isHostAllowlisted,
  isPrivateAddress,
  normalizeDistrictUrl,
} from "@/lib/hac/url";
import {
  ForbiddenHostProblem,
  InvalidDistrictInputProblem,
} from "@/lib/security/errors";

describe("district URL policy", () => {
  it("normalizes an HTTPS district URL and strips a trailing slash", () => {
    const district = normalizeDistrictUrl("https://hac.example.edu/HomeAccess/");
    expect(district.baseUrl).toBe("https://hac.example.edu/HomeAccess");
    expect(district.hostname).toBe("hac.example.edu");
  });

  it.each([
    "http://hac.example.edu",
    "https://user:secret@hac.example.edu",
    "https://hac.example.edu/HomeAccess?token=abc",
    "https://hac.example.edu/HomeAccess#fragment",
  ])("rejects unsafe or ambiguous district URL %s", (value) => {
    expect(() => normalizeDistrictUrl(value)).toThrow(InvalidDistrictInputProblem);
  });

  it.each([
    "https://localhost/HomeAccess",
    "https://127.0.0.1/HomeAccess",
    "https://169.254.169.254/latest/meta-data",
    "https://hac.internal/HomeAccess",
    "https://printer.local/",
  ])("rejects private or local host %s", (value) => {
    expect(() => normalizeDistrictUrl(value)).toThrow(ForbiddenHostProblem);
  });

  it("allows a normal public hostname", () => {
    expect(() =>
      normalizeDistrictUrl("https://hac.schooldistrict.org/HomeAccess"),
    ).not.toThrow();
  });
});

describe("address classification", () => {
  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
  ])("blocks private address %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2001:4860:4860::8888"])(
    "allows public address %s",
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );

  it("treats invalid addresses as private", () => {
    expect(isPrivateAddress("not-an-address")).toBe(true);
  });

  it("does not let an IPv4-mapped IPv6 spelling bypass the v4 blocklist", () => {
    expect(isPrivateAddress("::ffff:7f00:1")).toBe(true);
    expect(isPrivateAddress("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:8.8.8.8")).toBe(false);
    expect(isPrivateAddress("::ffff:0808:0808")).toBe(false);
  });
});

describe("host policy", () => {
  it("blocks local suffixes and IP literals", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("hac.internal")).toBe(true);
    expect(isBlockedHostname("10.0.0.1")).toBe(true);
    expect(isBlockedHostname("hac.example.edu")).toBe(false);
  });

  it("honors an optional allowlist", () => {
    const previous = process.env.HAC_ALLOWED_HOST_SUFFIXES;
    process.env.HAC_ALLOWED_HOST_SUFFIXES = "schooldistrict.org";

    try {
      expect(isHostAllowlisted("hac.schooldistrict.org")).toBe(true);
      expect(isHostAllowlisted("schooldistrict.org")).toBe(true);
      expect(isHostAllowlisted("evil.example")).toBe(false);
      expect(() => normalizeDistrictUrl("https://evil.example")).toThrow(
        ForbiddenHostProblem,
      );
    } finally {
      if (previous === undefined) delete process.env.HAC_ALLOWED_HOST_SUFFIXES;
      else process.env.HAC_ALLOWED_HOST_SUFFIXES = previous;
    }
  });

  it("allows only the same host or a configured SSO suffix on redirect", () => {
    expect(() =>
      assertRedirectHostAllowed("hac.example.edu", "hac.example.edu", []),
    ).not.toThrow();

    expect(() =>
      assertRedirectHostAllowed("login.example.edu", "hac.example.edu", [
        "example.edu",
      ]),
    ).not.toThrow();

    expect(() =>
      assertRedirectHostAllowed("evil.example", "hac.example.edu", []),
    ).toThrow(ForbiddenHostProblem);
  });
});
