import { describe, expect, it } from "vitest";
import { clearCredentialFields, extractForm } from "@/lib/hac/html-form";

const FORM_HTML = `
  <html><body>
    <form action="/HomeAccess/Account/LogOn?ReturnUrl=%2FHomeAccess%2F" method="post">
      <input type="hidden" name="__VIEWSTATE" value="state-token">
      <input type="hidden" name="__EVENTVALIDATION" value="event-token">
      <input type="text" name="LogOnDetails.UserName" value="">
      <input type="password" name="LogOnDetails.Password" value="">
      <select name="campus">
        <option value="1">North Campus</option>
        <option value="2" selected>South Campus</option>
      </select>
      <input type="submit" name="LoginButton" value="Log On">
    </form>
  </body></html>
`;

const PAGE_URL = new URL("https://hac.example.edu/HomeAccess/Account/LogOn");

describe("HAC form replay", () => {
  it("extracts hidden values, fields and the selected option but no password", () => {
    const form = extractForm(FORM_HTML, { pageUrl: PAGE_URL });

    expect(form?.method).toBe("POST");
    expect(form?.action.pathname).toBe("/HomeAccess/Account/LogOn");
    expect(form?.fields).toMatchObject({
      __VIEWSTATE: "state-token",
      __EVENTVALIDATION: "event-token",
      "LogOnDetails.UserName": "",
      campus: "2",
      LoginButton: "Log On",
    });
    expect(form?.fields["LogOnDetails.Password"]).toBeUndefined();
  });

  it("applies identity overrides without keeping stale credential fields", () => {
    const form = extractForm(FORM_HTML, {
      pageUrl: PAGE_URL,
      fieldOverrides: {
        "LogOnDetails.UserName": "jordan",
        "LogOnDetails.Password": "not-logged",
      },
      includePasswords: true,
    });

    expect(form?.fields["LogOnDetails.UserName"]).toBe("jordan");
    expect(form?.fields["LogOnDetails.Password"]).toBe("not-logged");
  });

  it("removes username/password-shaped values while preserving submit controls", () => {
    const form = extractForm(FORM_HTML, { pageUrl: PAGE_URL });
    const cleaned = clearCredentialFields(form?.fields ?? {});

    expect(cleaned["LogOnDetails.UserName"]).toBeUndefined();
    expect(cleaned.LoginButton).toBe("Log On");
    expect(cleaned.__VIEWSTATE).toBe("state-token");
  });

  it("returns null when there is no form", () => {
    expect(extractForm("<p>No form here</p>", { pageUrl: PAGE_URL })).toBeNull();
  });

  it("selects the form containing the password field", () => {
    const html = `
      <form action="/search" method="get"><input name="q"></form>
      <form action="/login" method="post">
        <input name="user"><input type="password" name="pw">
      </form>`;
    const form = extractForm(html, {
      pageUrl: PAGE_URL,
      formSelector: 'form:has(input[type="password"])',
      fallbackToFirstForm: false,
    });
    expect(form?.action.pathname).toBe("/login");
    expect(form?.fields.user).toBe("");
  });

  it("can refuse to fall back to an unrelated form", () => {
    expect(
      extractForm(FORM_HTML, {
        pageUrl: PAGE_URL,
        formSelector: "#does-not-exist",
        fallbackToFirstForm: false,
      }),
    ).toBeNull();
  });
});
