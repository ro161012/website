import { describe, expect, it } from "vitest";
import { HAC_NETWORKS } from "@/lib/config/hac-networks";
import { parseDistrictDirectory } from "@/lib/hac/districts";

const ARKANSAS_LOGIN = `
<!doctype html>
<html>
  <body>
    <form action="/HomeAccess/Account/LogOn" method="post">
      <input type="hidden" name="__RequestVerificationToken" value="token" />
      <select id="Database" name="Database">
        <option value="">Select a District</option>
        <option value="10">Academics Plus Charter</option>
        <option value="20" selected>Alma School District</option>
        <option value="30">Bauxite School District</option>
      </select>
      <input type="text" name="LogOnDetails.UserName" />
      <input type="password" name="LogOnDetails.Password" />
      <button type="submit">Sign In</button>
    </form>
  </body>
</html>
`;

describe("HAC district directory", () => {
  it("only advertises HTTPS network addresses", () => {
    expect(HAC_NETWORKS.length).toBeGreaterThan(0);
    for (const network of HAC_NETWORKS) {
      expect(network.url.startsWith("https://")).toBe(true);
    }
    expect(new Set(HAC_NETWORKS.map((network) => network.id)).size).toBe(
      HAC_NETWORKS.length,
    );
  });

  it("finds every district option and the selected value", () => {
    const directory = parseDistrictDirectory(ARKANSAS_LOGIN);

    expect(directory?.field).toBe("Database");
    expect(directory?.selectedId).toBe("20");
    expect(directory?.options).toEqual([
      { id: "10", name: "Academics Plus Charter" },
      { id: "20", name: "Alma School District" },
      { id: "30", name: "Bauxite School District" },
    ]);
  });

  it("ignores year and training selectors without district options", () => {
    const directory = parseDistrictDirectory(`
      <html><body><form>
        <select id="Year" name="Year">
          <option value="26_27" selected>Current School Year 26_27</option>
          <option value="25_26">Previous School Year 25_26</option>
        </select>
        <input type="password" name="pw" />
      </form></body></html>
    `);

    expect(directory).toBeNull();
  });

  it("does not treat a plain login form as a district picker", () => {
    const directory = parseDistrictDirectory(`
      <html><body><form>
        <input type="text" name="username" />
        <input type="password" name="password" />
      </form></body></html>
    `);

    expect(directory).toBeNull();
  });
});
