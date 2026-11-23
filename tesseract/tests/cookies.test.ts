import { describe, expect, it } from "vitest";
import { CookieJar, parseSetCookie } from "@/lib/hac/cookies";

const LOGIN_URL = new URL("https://hac.example.edu/HomeAccess/Account/LogOn");

describe("HAC cookie jar", () => {
  it("parses standard Set-Cookie attributes", () => {
    const cookie = parseSetCookie(
      "ASP.NET_SessionId=abc123; Path=/; Secure; HttpOnly; SameSite=Lax",
      LOGIN_URL,
    );

    expect(cookie).toMatchObject({
      name: "ASP.NET_SessionId",
      value: "abc123",
      domain: "hac.example.edu",
      path: "/",
      secure: true,
      httpOnly: true,
      expiresAt: null,
    });
  });

  it("sends root cookies to the schedule page and never to another host", () => {
    const jar = new CookieJar();
    jar.addFromResponse(
      ["ASP.NET_SessionId=abc123; Path=/; Secure; HttpOnly"],
      LOGIN_URL,
    );

    expect(
      jar.headerFor(
        new URL("https://hac.example.edu/HomeAccess/Content/Student/Classes.aspx"),
      ),
    ).toBe("ASP.NET_SessionId=abc123");
    expect(jar.headerFor(new URL("https://other.example.edu/HomeAccess/"))).toBe("");
  });

  it("respects path scoping", () => {
    const jar = new CookieJar();
    jar.addFromResponse(
      ["scoped=yes; Path=/HomeAccess/Account; Secure"],
      LOGIN_URL,
    );

    expect(
      jar.headerFor(new URL("https://hac.example.edu/HomeAccess/Account/LogOn")),
    ).toBe("scoped=yes");
    expect(
      jar.headerFor(new URL("https://hac.example.edu/HomeAccess/Classes.aspx")),
    ).toBe("");
  });

  it("does not send cookies to unrelated domains", () => {
    const jar = new CookieJar();
    jar.addFromResponse(
      ["district=one; Domain=.example.edu; Path=/; Secure"],
      LOGIN_URL,
    );

    expect(jar.headerFor(new URL("https://hac.example.edu/HomeAccess/"))).toContain(
      "district=one",
    );
    expect(jar.headerFor(new URL("https://notexample.edu/HomeAccess/"))).toBe("");
  });

  it("removes cookies on Max-Age=0 and drops expired cookies", () => {
    const jar = new CookieJar();
    jar.addFromResponse(["session=old; Path=/; Secure"], LOGIN_URL);
    jar.addFromResponse(
      ["session=deleted; Path=/; Max-Age=0; Secure"],
      LOGIN_URL,
    );

    expect(jar.headerFor(new URL("https://hac.example.edu/HomeAccess/"))).toBe("");

    const stale = parseSetCookie(
      "stale=1; Path=/; Expires=Wed, 21 Oct 2015 07:28:00 GMT",
      LOGIN_URL,
    );
    const jarWithStale = new CookieJar(stale ? [stale] : []);
    expect(
      jarWithStale.headerFor(new URL("https://hac.example.edu/HomeAccess/")),
    ).toBe("");
  });

  it("ignores malformed Set-Cookie lines", () => {
    expect(parseSetCookie("=missing-name; Path=/", LOGIN_URL)).toBeNull();
    expect(parseSetCookie("no-equals", LOGIN_URL)).toBeNull();
    expect(parseSetCookie("bad name=value; Path=/", LOGIN_URL)).toBeNull();
  });
});
