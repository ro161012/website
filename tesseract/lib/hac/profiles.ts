import { z } from "zod";
import { ConfigurationProblem } from "@/lib/security/errors";

const HacPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(400)
  .refine((value) => value.startsWith("/"), "A profile path must start with /.")
  .refine(
    (value) => !value.includes("..") && !value.includes("\\") && !value.includes("#"),
    "A profile path cannot contain traversal, backslashes or fragments.",
  );

const SelectorSchema = z.string().trim().min(1).max(300);
const HostPatternSchema = z.string().trim().min(1).max(255);
const MarkerSchema = z.string().trim().min(1).max(120);

const PathsSchema = z.strictObject({
  login: HacPathSchema,
  home: HacPathSchema,
  schedule: HacPathSchema,
  classSchedule: HacPathSchema,
  classwork: HacPathSchema,
  attendance: HacPathSchema,
  transcript: HacPathSchema,
  reportCard: HacPathSchema,
});

const SelectorsSchema = z.strictObject({
  assignment: SelectorSchema,
  courseTitle: SelectorSchema,
  courseTeacher: SelectorSchema,
  courseRoom: SelectorSchema,
  courseAverage: SelectorSchema,
  coursePeriod: SelectorSchema,
  categoryTable: SelectorSchema,
  categoryRow: SelectorSchema,
  categoryName: SelectorSchema,
  categoryWeight: SelectorSchema,
  categoryAverage: SelectorSchema,
  assignmentTable: SelectorSchema,
  assignmentRow: SelectorSchema,
  assignmentName: SelectorSchema,
  assignmentDue: SelectorSchema,
  assignmentCategory: SelectorSchema,
  assignmentScore: SelectorSchema,
  assignmentPointsPossible: SelectorSchema,
  assignmentStatus: SelectorSchema,
  markingPeriodSelect: SelectorSchema,
  attendanceTable: SelectorSchema,
  attendanceRow: SelectorSchema,
  attendanceDate: SelectorSchema,
  attendanceStatus: SelectorSchema,
  attendanceCourse: SelectorSchema,
  attendancePeriod: SelectorSchema,
  transcriptRow: SelectorSchema,
  transcriptCourse: SelectorSchema,
  transcriptYear: SelectorSchema,
  transcriptTerm: SelectorSchema,
  transcriptGrade: SelectorSchema,
  transcriptCredits: SelectorSchema,
  transcriptGpa: SelectorSchema,
  transcriptRank: SelectorSchema,
  reportTable: SelectorSchema,
  reportRow: SelectorSchema,
  reportCourse: SelectorSchema,
  reportGrade: SelectorSchema,
  reportCredits: SelectorSchema,
});

const QuirksSchema = z.strictObject({
  userAgent: z.string().trim().min(1).max(300),
  loginFormSelector: SelectorSchema,
  loginUsernameField: z.string().trim().min(1).max(120).nullable(),
  loginPasswordField: z.string().trim().min(1).max(120).nullable(),
  studentPickerRowSelector: SelectorSchema,
  studentPickerSubmitSelector: SelectorSchema,
  markingPeriodLabelPrefix: z.string().trim().max(60),
  attendanceCalendar: z.boolean(),
  transcriptGroupedByYear: z.boolean(),
  invalidLoginMarkers: z.array(MarkerSchema).max(20),
  mfaMarkers: z.array(MarkerSchema).max(20),
  ssoHostSuffixes: z.array(HostPatternSchema).max(20),
});

const ProfileOverrideSchema = z.strictObject({
  id: z.string().trim().min(1).max(64).regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().trim().min(1).max(120),
  baseProfile: z.string().trim().min(1).max(64).optional(),
  matchHosts: z.array(HostPatternSchema).min(1).max(50),
  paths: PathsSchema.partial().optional(),
  selectors: SelectorsSchema.partial().optional(),
  quirks: QuirksSchema.partial().optional(),
});

export type ProfileOverride = z.infer<typeof ProfileOverrideSchema>;

export const DistrictProfileSchema = z.strictObject({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  version: z.number().int().positive(),
  matchHosts: z.array(HostPatternSchema).min(1),
  paths: PathsSchema,
  selectors: SelectorsSchema,
  quirks: QuirksSchema,
});
export type DistrictProfile = z.infer<typeof DistrictProfileSchema>;

export const DEFAULT_PROFILE: DistrictProfile = {
  id: "hac-default",
  label: "Home Access Center (generic)",
  version: 1,
  matchHosts: ["*"],
  paths: {
    login: "/HomeAccess/Account/LogOn?ReturnUrl=%2FHomeAccess%2F",
    home: "/HomeAccess/",
    schedule: "/HomeAccess/Content/Student/Classes.aspx",
    classSchedule: "/HomeAccess/Content/Student/Classes.aspx",
    classwork: "/HomeAccess/Content/Student/Assignments.aspx",
    attendance: "/HomeAccess/Content/Student/Attendance.aspx",
    transcript: "/HomeAccess/Content/Student/Transcript.aspx",
    reportCard: "/HomeAccess/Content/Student/ReportCards.aspx",
  },
  selectors: {
    assignment: "div.AssignmentClass",
    courseTitle:
      ".AssignmentClass .sg-header-heading, .AssignmentClass .course-title, .AssignmentClass h2",
    courseTeacher: ".AssignmentClass .teacher, .AssignmentClass .sg-header .teacher-name",
    courseRoom: ".AssignmentClass .room, .AssignmentClass .sg-header .room",
    courseAverage:
      ".AssignmentClass .average, .AssignmentClass .sg-header .sg-header-heading + .sg-header-heading",
    coursePeriod: ".AssignmentClass .period, .AssignmentClass .sg-header .period",
    categoryTable: 'table[id*="CourseCategories"], table[id*="Categories"]',
    categoryRow: "tr",
    categoryName: "td:nth-child(1)",
    categoryWeight: "td:nth-child(2)",
    categoryAverage: "td:nth-child(3)",
    assignmentTable: 'table[id*="CourseAssignments"], table[id*="Assignments"]',
    assignmentRow: "tr",
    assignmentName: "td:nth-child(1)",
    assignmentDue: "td:nth-child(2)",
    assignmentCategory: "td:nth-child(3)",
    assignmentScore: "td:nth-child(4)",
    assignmentPointsPossible: "td:nth-child(99)",
    assignmentStatus: "td:nth-child(5)",
    markingPeriodSelect:
      'select[id*="MarkingPeriod"], select[name*="MarkingPeriod"], select[id*="ReportingPeriod"]',
    attendanceTable: 'table[id*="Attendance"], table[class*="Attendance"]',
    attendanceRow: "tr",
    attendanceDate: "td:nth-child(1)",
    attendanceStatus: "td:nth-child(2)",
    attendanceCourse: "td:nth-child(3)",
    attendancePeriod: "td:nth-child(4)",
    transcriptRow: "tr",
    transcriptCourse: "td:nth-child(1)",
    transcriptYear: "td:nth-child(2)",
    transcriptTerm: "td:nth-child(3)",
    transcriptGrade: "td:nth-child(4)",
    transcriptCredits: "td:nth-child(5)",
    transcriptGpa: ".sg-transcript-gpa, .gpa",
    transcriptRank: ".class-rank, #ClassRank",
    reportTable: 'table[id*="ReportCard"], table[class*="ReportCard"]',
    reportRow: "tr",
    reportCourse: "td:nth-child(1)",
    reportGrade: "td:nth-child(2)",
    reportCredits: "td:nth-child(3)",
  },
  quirks: {
    userAgent: "Tesseract/0.2 (+student grade viewer)",
    loginFormSelector: "form",
    loginUsernameField: null,
    loginPasswordField: null,
    studentPickerRowSelector: "div.sg-student-picker-row",
    studentPickerSubmitSelector: 'input[type="submit"], button[type="submit"]',
    markingPeriodLabelPrefix: "",
    attendanceCalendar: false,
    transcriptGroupedByYear: false,
    invalidLoginMarkers: [
      "Invalid user name or password",
      "Invalid User Name or Password",
      "The user name or password provided is incorrect",
      "Your login attempt was not successful",
      "Your attempt to log in was unsuccessful",
      "Login failed",
    ],
    mfaMarkers: [
      "verification code",
      "two-factor",
      "two factor",
      "multi-factor",
      "multifactor",
      "authenticator",
      "security code",
    ],
    ssoHostSuffixes: [],
  },
};

function mergeProfile(
  base: DistrictProfile,
  override: ProfileOverride | undefined,
): DistrictProfile {
  if (!override) return base;
  return DistrictProfileSchema.parse({
    ...base,
    id: override.id,
    label: override.label,
    matchHosts: override.matchHosts,
    version: base.version + 1,
    paths: { ...base.paths, ...(override.paths ?? {}) },
    selectors: { ...base.selectors, ...(override.selectors ?? {}) },
    quirks: { ...base.quirks, ...(override.quirks ?? {}) },
  });
}

const BUILT_IN_OVERRIDES: ProfileOverride[] = [
  {
    id: "rrisd-hac",
    label: "Round Rock ISD Home Access Center",
    matchHosts: ["accesscenter.roundrockisd.org"],
    paths: {
      schedule: "/HomeAccess/Content/Student/Assignments.aspx",
      classSchedule: "/HomeAccess/Content/Student/Classes.aspx",
      classwork: "/HomeAccess/Content/Student/Assignments.aspx",
      attendance: "/HomeAccess/Content/Attendance/MonthlyView.aspx",
      transcript: "/HomeAccess/Content/Student/Transcript.aspx",
      reportCard: "/HomeAccess/Content/Student/ReportCards.aspx",
    },
    selectors: {
      courseTitle: "a.sg-header-heading",
      courseAverage: "span[id*='lblHdrAverage']",
      categoryWeight: "td:nth-child(5)",
      categoryAverage: "td:nth-child(4)",
      assignmentName: "td:nth-child(3)",
      assignmentDue: "td:nth-child(1)",
      assignmentCategory: "td:nth-child(4)",
      assignmentScore: "td:nth-child(5)",
      assignmentPointsPossible: "td:nth-child(6)",
      assignmentStatus: "td:nth-child(5)",
      markingPeriodSelect: "select#plnMain_ddlReportCardRuns",
      reportCourse: "td:nth-child(2)",
      reportGrade: "td:nth-child(8)",
      reportCredits: "td:nth-child(7)",
    },
    quirks: {
      markingPeriodLabelPrefix: "Marking period ",
      attendanceCalendar: true,
      transcriptGroupedByYear: true,
    },
  },
];

function readOverrides(): ProfileOverride[] {
  const raw = process.env.HAC_PROFILES?.trim();
  if (!raw) return [...BUILT_IN_OVERRIDES];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new ConfigurationProblem("HAC_PROFILES is not valid JSON.");
  }

  const result = z.array(ProfileOverrideSchema).max(20).safeParse(parsed);
  if (!result.success) {
    throw new ConfigurationProblem(
      "HAC_PROFILES does not match the district profile schema.",
    );
  }
  return [...result.data, ...BUILT_IN_OVERRIDES];
}

function profilesById(): Map<string, DistrictProfile> {
  const overrides = readOverrides();
  const byId = new Map<string, DistrictProfile>();
  byId.set(DEFAULT_PROFILE.id, DEFAULT_PROFILE);

  const findOverride = (id: string): ProfileOverride | undefined =>
    overrides.find((candidate) => candidate.id === id);

  const resolve = (id: string, stack: Set<string>): DistrictProfile => {
    const cached = byId.get(id);
    if (cached) return cached;
    if (stack.has(id)) {
      throw new ConfigurationProblem("HAC_PROFILES contains a baseProfile cycle.");
    }

    const override = findOverride(id);
    if (!override) {
      throw new ConfigurationProblem(`Unknown HAC profile: ${id}.`);
    }

    stack.add(id);
    const base = override.baseProfile
      ? resolve(override.baseProfile, stack)
      : DEFAULT_PROFILE;
    const profile = mergeProfile(base, override);
    byId.set(id, profile);
    return profile;
  };

  for (const override of overrides) {
    resolve(override.id, new Set());
  }

  return byId;
}

function hostMatches(pattern: string, hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const normalized = pattern.toLowerCase().replace(/\.$/, "");
  if (normalized === "*") return true;
  if (normalized.startsWith("*.")) {
    const suffix = normalized.slice(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  return host === normalized;
}

export function getProfileById(id: string): DistrictProfile {
  const profile = profilesById().get(id);
  if (!profile) {
    throw new ConfigurationProblem(`Unknown HAC profile: ${id}.`);
  }
  return profile;
}

/** Select the most specific configured profile for a district host. */
export function selectProfileForHost(hostname: string): DistrictProfile {
  const forced = process.env.HAC_PROFILE?.trim();
  if (forced) return getProfileById(forced);

  const host = hostname.toLowerCase().replace(/\.$/, "");
  const candidates = [...profilesById().values()]
    .filter(
      (profile) =>
        profile.id !== DEFAULT_PROFILE.id &&
        profile.matchHosts.some((pattern) => hostMatches(pattern, host)),
    )
    .sort((a, b) => {
      const score = (profile: DistrictProfile): number =>
        Math.max(
          ...profile.matchHosts.map((pattern) => {
            if (pattern === "*") return 0;
            return pattern.includes("*") ? pattern.length : pattern.length + 1000;
          }),
        );
      return score(b) - score(a);
    });

  return candidates[0] ?? DEFAULT_PROFILE;
}

export function profileForDistrictUrl(baseUrl: string): DistrictProfile {
  return selectProfileForHost(new URL(baseUrl).hostname);
}
