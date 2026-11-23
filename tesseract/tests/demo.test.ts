import { describe, expect, it } from "vitest";
import {
  DEMO_ASSIGNMENT_COUNT,
  DEMO_COURSE_COUNT,
  DEMO_MARKING_PERIODS,
  DemoProvider,
} from "@/lib/providers/demo";
import { createSession } from "@/lib/session/crypto";
import { demoSessionInput } from "@/lib/demo/session";
import { NotFoundProblem } from "@/lib/security/errors";

function provider(): DemoProvider {
  return new DemoProvider(createSession(demoSessionInput()));
}

describe("demo provider", () => {
  it("describes a complete, deterministic sample student", async () => {
    const me = await provider().getMe();

    expect(me.data.mode).toBe("demo");
    expect(me.data.student.displayName).toBe("Jordan Ellis");
    expect(me.data.students).toHaveLength(1);
    expect(me.data.markingPeriods).toHaveLength(3);
    expect(me.data.activeMarkingPeriodId).toBe("mp2");
    expect(me.warnings).toEqual([]);
    expect(Date.parse(me.fetchedAt)).not.toBeNaN();
  });

  it("has seven courses in every marking period and sixty-three assignments total", async () => {
    const instance = provider();
    let assignmentCount = 0;

    for (const period of DEMO_MARKING_PERIODS) {
      const courses = await instance.getCourses(period.id);
      expect(courses.data).toHaveLength(DEMO_COURSE_COUNT);

      for (const summary of courses.data) {
        expect(summary.markingPeriodId).toBe(period.id);
        const detail = await instance.getCourse(summary.id, period.id);
        assignmentCount += detail.data.assignments.length;
        expect(detail.data.id).toBe(summary.id);
        expect(detail.data.assignments.every((assignment) => assignment.courseId === summary.id)).toBe(
          true,
        );
      }
    }

    expect(assignmentCount).toBe(DEMO_ASSIGNMENT_COUNT);
    expect(assignmentCount).toBe(63);
  });

  it("returns a fourteen-day upcoming window with course names", async () => {
    const upcoming = await provider().getUpcomingAssignments(14);

    expect(upcoming.data).toHaveLength(14);
    expect(
      upcoming.data.every(
        (assignment) =>
          assignment.dueDate !== null &&
          assignment.dueDate >= "2026-11-21" &&
          assignment.dueDate <= "2026-12-05",
      ),
    ).toBe(true);
    expect(upcoming.data[0]?.courseName).toBeTruthy();
  });

  it("filters attendance by month", async () => {
    const instance = provider();
    const november = await instance.getAttendance("2026-11");
    const october = await instance.getAttendance("2026-10");

    expect(november.data.length).toBeGreaterThan(0);
    expect(october.data.length).toBeGreaterThan(0);
    expect(november.data.every((day) => day.date.startsWith("2026-11-"))).toBe(true);
    expect(october.data.every((day) => day.date.startsWith("2026-10-"))).toBe(true);
    expect(november.data.some((day) => day.status === "absent")).toBe(true);
  });

  it("includes two reports and a full transcript", async () => {
    const instance = provider();
    const reports = await instance.getReports();
    const transcript = await instance.getTranscript();

    expect(reports.data).toHaveLength(2);
    expect(reports.data[0]?.entries).toHaveLength(7);
    expect(reports.data.map((report) => report.kind)).toEqual([
      "report_card",
      "progress_report",
    ]);
    expect(transcript.data.entries).toHaveLength(9);
    expect(transcript.data.gpa).toEqual({ weighted: 4.12, unweighted: 3.78 });
    expect(transcript.data.rank).toEqual({ position: 42, outOf: 486 });
  });

  it("rejects unknown courses and marking periods", async () => {
    const instance = provider();
    await expect(instance.getCourse("course_missing", "mp2")).rejects.toBeInstanceOf(
      NotFoundProblem,
    );
    await expect(instance.getCourses("mp_missing")).rejects.toBeInstanceOf(
      NotFoundProblem,
    );
  });

  it("supports switching to a student already in the demo session", async () => {
    const session = createSession(demoSessionInput());
    const instance = new DemoProvider(session);
    const switched = await instance.switchStudent(session.activeStudentId);

    expect(switched.data.id).toBe(session.activeStudentId);
  });
});
