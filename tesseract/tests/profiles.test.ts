import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE,
  getProfileById,
  selectProfileForHost,
} from "@/lib/hac/profiles";
import { ConfigurationProblem } from "@/lib/security/errors";

const previousProfiles = process.env.HAC_PROFILES;
const previousProfile = process.env.HAC_PROFILE;

afterEach(() => {
  if (previousProfiles === undefined) delete process.env.HAC_PROFILES;
  else process.env.HAC_PROFILES = previousProfiles;
  if (previousProfile === undefined) delete process.env.HAC_PROFILE;
  else process.env.HAC_PROFILE = previousProfile;
});

describe("configurable district profiles", () => {
  it("falls back to the generic profile for an unmatched host", () => {
    delete process.env.HAC_PROFILES;
    delete process.env.HAC_PROFILE;

    const profile = selectProfileForHost("hac.example.edu");
    expect(profile.id).toBe(DEFAULT_PROFILE.id);
    expect(profile.paths.login).toBe(DEFAULT_PROFILE.paths.login);
  });

  it("merges a host-specific override over the generic profile", () => {
    process.env.HAC_PROFILES = JSON.stringify([
      {
        id: "our-district",
        label: "Our district",
        matchHosts: ["hac.school.edu", "*.school.edu"],
        paths: { schedule: "/Custom/Classes.aspx" },
        selectors: { assignment: "div.CourseCard" },
        quirks: { invalidLoginMarkers: ["Nope, try again"] },
      },
    ]);

    const profile = selectProfileForHost("hac.school.edu");
    expect(profile.id).toBe("our-district");
    expect(profile.version).toBe(DEFAULT_PROFILE.version + 1);
    expect(profile.paths.schedule).toBe("/Custom/Classes.aspx");
    expect(profile.paths.login).toBe(DEFAULT_PROFILE.paths.login);
    expect(profile.selectors.assignment).toBe("div.CourseCard");
    expect(profile.selectors.categoryTable).toBe(DEFAULT_PROFILE.selectors.categoryTable);
    expect(profile.quirks.invalidLoginMarkers).toEqual(["Nope, try again"]);
    expect(profile.quirks.userAgent).toBe(DEFAULT_PROFILE.quirks.userAgent);
  });

  it("supports a base profile chain and a forced profile", () => {
    process.env.HAC_PROFILES = JSON.stringify([
      {
        id: "base-district",
        label: "Base",
        matchHosts: ["hac.school.edu"],
        paths: { schedule: "/Base/Classes.aspx" },
      },
      {
        id: "campus-district",
        label: "Campus",
        baseProfile: "base-district",
        matchHosts: ["campus.school.edu"],
        paths: { schedule: "/Campus/Classes.aspx" },
      },
    ]);
    process.env.HAC_PROFILE = "campus-district";

    const forced = getProfileById("campus-district");
    expect(forced.paths.schedule).toBe("/Campus/Classes.aspx");
    expect(forced.version).toBe(DEFAULT_PROFILE.version + 2);
    expect(selectProfileForHost("unmatched.example").id).toBe("campus-district");
  });

  it("rejects malformed or cyclic profile configuration", () => {
    process.env.HAC_PROFILES = "not json";
    expect(() => selectProfileForHost("hac.school.edu")).toThrow(
      ConfigurationProblem,
    );

    process.env.HAC_PROFILES = JSON.stringify([
      {
        id: "a",
        label: "A",
        baseProfile: "b",
        matchHosts: ["a.example"],
      },
      {
        id: "b",
        label: "B",
        baseProfile: "a",
        matchHosts: ["b.example"],
      },
    ]);
    expect(() => getProfileById("a")).toThrow(ConfigurationProblem);
  });
});
