import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "@/lib/hac/profiles";
import {
  parseAttendance,
  parseMarkingPeriods,
  parseSchedule,
  parseTranscript,
  readMarkingPeriodOptions,
} from "@/lib/hac/parsers";
import { HAC_ATTENDANCE, HAC_SCHEDULE, HAC_TRANSCRIPT } from "./fixtures/hac";

const PAGE_URL = new URL(
  "https://hac.example.edu/HomeAccess/Content/Student/Classes.aspx",
);

describe("HAC schedule parser", () => {
  it("reads marking periods and their current selection", () => {
    const options = readMarkingPeriodOptions(HAC_SCHEDULE, DEFAULT_PROFILE);
    expect(options.map((option) => option.label)).toEqual([
      "Marking Period 1",
      "Marking Period 2",
      "Marking Period 3",
    ]);
    expect(options[1]?.selected).toBe(true);
    expect(options[1]?.postBackTarget).toBe("ctl00$MainContent$MarkingPeriod");

    const result = parseMarkingPeriods(HAC_SCHEDULE, DEFAULT_PROFILE);
    expect(result.markingPeriods).toHaveLength(3);
    expect(result.markingPeriods[1]).toMatchObject({
      name: "Marking Period 2",
      isCurrent: true,
      sequence: 1,
    });
  });

  it("reads courses, categories, grades and assignment states", () => {
    const result = parseSchedule(HAC_SCHEDULE, PAGE_URL, "mp_test", DEFAULT_PROFILE);

    expect(result.courses).toHaveLength(2);
    const ap = result.courses[0];
    expect(ap).toBeDefined();
    expect(ap).toMatchObject({
      name: "AP English Language",
      level: "ap",
      period: "1",
      room: "A-112",
      markingPeriodId: "mp_test",
    });
    expect(ap?.teacher?.name).toBe("Elena Alvarez");
    expect(ap?.grade.percent).toBe(94.2);
    expect(ap?.shortName).toBe("AP English Language");
    expect(ap?.categories).toHaveLength(2);
    expect(ap?.assignments).toHaveLength(2);

    const graded = ap?.assignments[0];
    expect(graded).toMatchObject({
      name: "Rhetorical analysis",
      dueDate: "2026-11-04",
      score: 94,
      pointsPossible: 100,
      percent: 94,
      status: "graded",
    });
    expect(graded?.categoryId).toBe(ap?.categories[0]?.id);

    const missing = ap?.assignments[1];
    expect(missing).toMatchObject({
      name: "Syntax check",
      dueDate: "2026-11-12",
      status: "missing",
      score: 0,
      percent: 0,
    });
    expect(missing?.categoryId).toBe(ap?.categories[1]?.id);
    expect(ap?.categories[0]?.assignmentIds).toEqual([graded?.id]);
  });

  it("keeps a course with missing tables and emits partial-data warnings", () => {
    const result = parseSchedule(HAC_SCHEDULE, PAGE_URL, "mp_test", DEFAULT_PROFILE);
    const band = result.courses[1];
    expect(band?.name).toBe("Concert Band");
    expect(band?.categories).toEqual([]);
    expect(band?.assignments).toEqual([]);

    const codes = result.warnings.map((warning) => warning.code);
    expect(codes).toContain("categories_missing");
    expect(codes).toContain("assignments_missing");
  });

  it("warns instead of throwing when no course cards exist", () => {
    const result = parseSchedule(
      "<html><body><p>No classes</p></body></html>",
      PAGE_URL,
      "mp_current",
      DEFAULT_PROFILE,
    );
    expect(result.courses).toEqual([]);
    expect(result.warnings.some((warning) => warning.code === "courses_missing")).toBe(
      true,
    );
  });
});

describe("HAC attendance parser", () => {
  it("reads dates and normalizes statuses", () => {
    const result = parseAttendance(HAC_ATTENDANCE, DEFAULT_PROFILE);
    expect(result.days).toHaveLength(4);
    expect(result.days.map((day) => day.status)).toEqual([
      "present",
      "absent",
      "tardy",
      "excused",
    ]);
    expect(result.days[1]?.date).toBe("2026-11-03");
    expect(result.days[0]?.periods).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("warns when the attendance table is missing", () => {
    const result = parseAttendance("<html><body></body></html>", DEFAULT_PROFILE);
    expect(result.days).toEqual([]);
    expect(result.warnings[0]?.code).toBe("attendance_missing");
  });
});

describe("HAC transcript parser", () => {
  it("reads GPA, rank and transcript rows", () => {
    const result = parseTranscript(HAC_TRANSCRIPT, DEFAULT_PROFILE);

    expect(result.transcript.gpa).toEqual({
      weighted: 4.12,
      unweighted: 3.78,
    });
    expect(result.transcript.rank).toEqual({ position: 42, outOf: 486 });
    expect(result.transcript.entries).toHaveLength(2);
    expect(result.transcript.entries[0]).toMatchObject({
      courseName: "English 9 Honors",
      schoolYear: "2024–2025",
      term: "Full year",
      credits: 1,
      level: "honors",
      includedInGpa: true,
    });
    expect(result.transcript.entries[0]?.grade.percent).toBe(94);
    expect(result.warnings).toEqual([]);
  });

  it("returns an empty transcript with a warning when no rows exist", () => {
    const result = parseTranscript("<html><body></body></html>", DEFAULT_PROFILE);
    expect(result.transcript.entries).toEqual([]);
    expect(result.warnings[0]?.code).toBe("transcript_empty");
    expect(result.warnings.some((warning) => warning.code === "transcript_validation_failed")).toBe(
      false,
    );
  });
});
