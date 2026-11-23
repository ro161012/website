import { describe, expect, it } from "vitest";
import { getProfileById, selectProfileForHost } from "@/lib/hac/profiles";
import {
  courseLevelFromName,
  parseAttendance,
  parseMarkingPeriods,
  parseReportCards,
  parseSchedule,
  parseTranscript,
} from "@/lib/hac/parsers";
import {
  RRISD_ATTENDANCE,
  RRISD_CLASSWORK,
  RRISD_REPORT_CARD,
  RRISD_TRANSCRIPT,
} from "./fixtures/rrisd";

const PROFILE = getProfileById("rrisd-hac");
const PAGE_URL = new URL(
  "https://accesscenter.roundrockisd.org/HomeAccess/Content/Student/Assignments.aspx",
);

describe("RRISD HAC profile", () => {
  it("is selected automatically for the district host", () => {
    expect(selectProfileForHost("accesscenter.roundrockisd.org").id).toBe(
      "rrisd-hac",
    );
    expect(courseLevelFromName("APBIO")).toBe("ap");
    expect(courseLevelFromName("APSTATS")).toBe("ap");
  });

  it("reads the report-card run and classwork columns", () => {
    const periods = parseMarkingPeriods(RRISD_CLASSWORK, PROFILE);
    expect(periods.markingPeriods.map((period) => period.name)).toEqual([
      "Marking period 1",
      "Marking period 2",
      "Marking period 3",
      "Marking period 4",
    ]);
    expect(periods.markingPeriods[1]?.isCurrent).toBe(true);
    expect(periods.warnings).toEqual([]);

    const result = parseSchedule(
      RRISD_CLASSWORK,
      PAGE_URL,
      "mp_test",
      PROFILE,
    );
    expect(result.courses).toHaveLength(2);
    expect(result.courses[1]).toMatchObject({
      name: "TAG/AP Statistics",
      level: "ap",
    });

    const course = result.courses[0];
    expect(course).toMatchObject({
      name: "TAG/Advanced English II",
      markingPeriodId: "mp_test",
      level: "regular",
    });
    expect(course?.grade.percent).toBe(94.2);
    expect(course?.categories.map((category) => category.weightPercent)).toEqual([
      60, 40,
    ]);
    expect(course?.categories.map((category) => category.name)).toEqual([
      "Formative",
      "Summative",
    ]);
    expect(course?.categories.map((category) => category.averagePercent)).toEqual([
      90, 90,
    ]);
    expect(course?.assignments).toHaveLength(3);

    expect(course?.assignments[0]).toMatchObject({
      name: "Rhetorical analysis",
      dueDate: "2026-11-04",
      score: 45,
      pointsPossible: 50,
      percent: 90,
      status: "graded",
    });
    expect(course?.assignments[1]).toMatchObject({
      name: "Syntax check",
      dueDate: "2026-11-12",
      status: "missing",
      score: 0,
      percent: 0,
    });
    expect(course?.assignments[2]).toMatchObject({
      name: "Poetry response",
      dueDate: "2026-11-18",
      score: 18,
      pointsPossible: 20,
      percent: 90,
      status: "graded",
    });
  });

  it("reads explicit markings from the monthly attendance calendar", () => {
    const result = parseAttendance(RRISD_ATTENDANCE, PROFILE);
    expect(result.days).toEqual([
      expect.objectContaining({ date: "2026-11-04", status: "absent" }),
      expect.objectContaining({ date: "2026-11-05", status: "tardy" }),
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("reads RRISD report-card rows", () => {
    const result = parseReportCards(RRISD_REPORT_CARD, PROFILE);
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]?.entries[0]).toMatchObject({
      courseName: "TAG/Advanced English II",
      credits: 1,
    });
    expect(result.reports[0]?.entries[0]?.grade.percent).toBe(95);
    expect(result.warnings).toEqual([]);
  });

  it("reads transcript courses grouped by school year", () => {
    const result = parseTranscript(RRISD_TRANSCRIPT, PROFILE);
    expect(result.transcript.entries).toHaveLength(2);
    expect(result.transcript.entries[0]).toMatchObject({
      courseName: "TAG/Advanced English II",
      courseId: "1125A",
      schoolYear: "2025-26",
      term: "Full year",
      credits: 1,
    });
    expect(result.transcript.entries[0]?.grade.percent).toBe(95);
    expect(result.transcript.entries[1]?.level).toBe("ap");
    expect(result.transcript.gpa).toEqual({ weighted: 4.12, unweighted: 3.78 });
    expect(result.transcript.rank).toEqual({ position: 10, outOf: 500 });
    expect(result.transcript.creditsEarned).toBe(2);
    expect(result.warnings).toEqual([]);
  });
});
