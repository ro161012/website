import { describe, expect, it } from "vitest";
import { extractLoginFields } from "@/lib/hac/auth";
import { DEFAULT_PROFILE } from "@/lib/hac/profiles";

const RRISD_STYLE_LOGIN = `
<!doctype html>
<html>
  <head><title>Login</title></head>
  <body>
    <form action="/HomeAccess/Account/LogOn?ReturnUrl=%2FHomeAccess%2F" method="post">
      <input type="hidden" name="__RequestVerificationToken" value="token" />
      <input type="hidden" name="Type" value="" />
      <input type="hidden" name="LocalLogin" value="true" />
      <input type="hidden" name="SiteCode" value="district" />
      <input type="text" name="LogOnDetails.UserName" id="LogOnDetails_UserName" />
      <input type="text" name="tempUN" id="tempUN" />
      <input type="password" name="tempPW" id="tempPW" />
      <input type="password" name="LogOnDetails.Password" id="LogOnDetails_Password" />
      <button type="submit" name="login">Sign In</button>
    </form>
  </body>
</html>
`;

describe("HAC login field selection", () => {
  it("ignores decoy fields and targets the named username and password", () => {
    const form = extractLoginFields(
      RRISD_STYLE_LOGIN,
      new URL(
        "https://accesscenter.roundrockisd.org/HomeAccess/Account/LogOn?ReturnUrl=%2FHomeAccess%2F",
      ),
      DEFAULT_PROFILE,
    );

    expect(form.usernameField).toBe("LogOnDetails.UserName");
    expect(form.passwordField).toBe("LogOnDetails.Password");
    expect(form.fields.__RequestVerificationToken).toBe("token");
    expect(form.fields.tempUN).toBe("");
    expect(form.fields.tempPW).toBeUndefined();
    expect(form.fields.type).toBeUndefined();
  });
});
