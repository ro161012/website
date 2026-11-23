import { describe, expect, it } from "vitest";
import type { Snapshot } from "@/lib/types";
import {
  averageTrend,
  courseTrends,
  diffSnapshots,
  formatDelta,
  snapshotAverage,
} from "@/lib/client/insights";

function snapshot(
  id: string,
  capturedAt: string,
  courses: Array<{
    id: string;
    name: string;
    percent: number | null;
    hashes?: Record<string, string>;
  }>,
): Snapshot {
  return {
    id,
    studentId: "stu_test_jordan",
    markingPeriodId: "mp_2",
    capturedAt,
    courses: courses.map((course) => ({
      courseId: course.id,
      courseName: course.name,
      grade: { percent: course.percent, letter: null },
      assignmentHashes: course.hashes ?? {},
    })),
  };
}

describe("local snapshot insights", () => {
  const previous = snapshot("snap_1", "2026-11-10T12:00:00.000Z", [
    { id: "course_a", name: "Algebra", percent: 80, hashes: { asg_1: "old" } },
    { id: "course_b", name: "Biology", percent: 90, hashes: { asg_2: "same" } },
  ]);
  const current = snapshot("snap_2", "2026-11-20T12:00:00.000Z", [
    { id: "course_a", name: "Algebra", percent: 86, hashes: { asg_1: "new" } },
    { id: "course_b", name: "Biology", percent: 90, hashes: { asg_2: "same" } },
    {
      id: "course_c",
      name: "Chemistry",
      percent: 70,
      hashes: { asg_3: "added" },
    },
  ]);

  it("averages only numeric course grades", () => {
    expect(snapshotAverage(previous)).toBeCloseTo(85, 5);
    expect(
      snapshotAverage(
        snapshot("snap_empty", "2026-11-20T12:00:00.000Z", [
          { id: "course_a", name: "Algebra", percent: null },
        ]),
      ),
    ).toBeNull();
  });

  it("reports changed and added assignments plus the average delta", () => {
    const diff = diffSnapshots(previous, current);
    expect(diff.averageDelta).toBeCloseTo(-3, 5);
    expect(diff.addedAssignments).toEqual([{ courseId: "course_c", assignmentId: "asg_3" }]);
    expect(diff.changedAssignments).toEqual([{ courseId: "course_a", assignmentId: "asg_1" }]);
  });

  it("returns an empty diff when either side is missing", () => {
    expect(diffSnapshots(null, current)).toEqual({
      averageDelta: null,
      addedAssignments: [],
      changedAssignments: [],
    });
  });

  it("anchors a trend window to the supplied instant", () => {
    const points = averageTrend(
      [previous, current],
      30,
      Date.parse("2026-11-21T00:00:00.000Z"),
    );
    expect(points.map((point) => point.value)).toEqual([85, 82]);
    expect(points[0]?.at).toBe(previous.capturedAt);
  });

  it("drops snapshots outside the window", () => {
    const points = averageTrend(
      [previous, current],
      5,
      Date.parse("2026-11-21T00:00:00.000Z"),
    );
    expect(points).toHaveLength(1);
    expect(points[0]?.value).toBe(82);
  });

  it("keeps only courses with a real delta", () => {
    const trends = courseTrends([current, previous]);
    expect(trends.map((trend) => trend.courseId)).toEqual(["course_a"]);
    expect(trends[0]?.delta).toBe(6);
    expect(trends.find((trend) => trend.courseId === "course_b")).toBeUndefined();
    expect(trends.find((trend) => trend.courseId === "course_c")).toBeUndefined();
  });

  it("formats deltas without noisy decimals", () => {
    expect(formatDelta(null)).toBe("No history yet");
    expect(formatDelta(0)).toBe("No change pts");
    expect(formatDelta(2.46)).toBe("+2.5 pts");
    expect(formatDelta(-1.2, "%")).toBe("-1.2%");
  });
});
