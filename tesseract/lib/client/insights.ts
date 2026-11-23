"use client";

import type { Snapshot } from "@/lib/types";

export interface TrendPoint {
  at: string;
  value: number;
}

export interface CourseTrend {
  courseId: string;
  courseName: string;
  first: number;
  last: number;
  delta: number;
}

export interface SnapshotDiff {
  averageDelta: number | null;
  addedAssignments: Array<{ courseId: string; assignmentId: string }>;
  changedAssignments: Array<{ courseId: string; assignmentId: string }>;
}

export function snapshotAverage(snapshot: Snapshot): number | null {
  const values = snapshot.courses
    .map((course) => course.grade.percent)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function averageTrend(
  snapshots: Snapshot[],
  days: number,
  nowMs: number = Date.now(),
): TrendPoint[] {
  const cutoff = nowMs - days * 86_400_000;
  return snapshots
    .filter((snapshot) => Date.parse(snapshot.capturedAt) >= cutoff)
    .map((snapshot) => {
      const value = snapshotAverage(snapshot);
      return value === null ? null : { at: snapshot.capturedAt, value };
    })
    .filter((point): point is TrendPoint => point !== null)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function courseTrends(snapshots: Snapshot[]): CourseTrend[] {
  const byCourse = new Map<string, { name: string; points: number[] }>();
  for (const snapshot of [...snapshots].sort((a, b) =>
    a.capturedAt.localeCompare(b.capturedAt),
  )) {
    for (const course of snapshot.courses) {
      const percent = course.grade.percent;
      if (percent === null) continue;
      const entry = byCourse.get(course.courseId) ?? {
        name: course.courseName,
        points: [],
      };
      entry.points.push(percent);
      byCourse.set(course.courseId, entry);
    }
  }

  return [...byCourse.entries()]
    .map(([courseId, entry]) => {
      const first = entry.points[0] ?? 0;
      const last = entry.points[entry.points.length - 1] ?? first;
      return {
        courseId,
        courseName: entry.name,
        first,
        last,
        delta: last - first,
      };
    })
    .filter((trend) => trend.delta !== 0)
    .sort((a, b) => b.delta - a.delta);
}

export function diffSnapshots(previous: Snapshot | null, current: Snapshot | null): SnapshotDiff {
  const result: SnapshotDiff = {
    averageDelta: null,
    addedAssignments: [],
    changedAssignments: [],
  };
  if (!previous || !current) return result;

  const before = snapshotAverage(previous);
  const after = snapshotAverage(current);
  result.averageDelta =
    before !== null && after !== null ? Math.round((after - before) * 10) / 10 : null;

  const previousHashes = new Map<string, string>();
  for (const course of previous.courses) {
    for (const [assignmentId, hash] of Object.entries(course.assignmentHashes)) {
      previousHashes.set(`${course.courseId}:${assignmentId}`, hash);
    }
  }

  for (const course of current.courses) {
    for (const [assignmentId, hash] of Object.entries(course.assignmentHashes)) {
      const key = `${course.courseId}:${assignmentId}`;
      const old = previousHashes.get(key);
      if (old === undefined) {
        result.addedAssignments.push({ courseId: course.courseId, assignmentId });
      } else if (old !== hash) {
        result.changedAssignments.push({ courseId: course.courseId, assignmentId });
      }
    }
  }

  return result;
}

export function formatDelta(value: number | null, suffix = " pts"): string {
  if (value === null || !Number.isFinite(value)) return "No history yet";
  if (value === 0) return `No change${suffix}`;
  return `${value > 0 ? "+" : ""}${Math.round(value * 10) / 10}${suffix}`;
}
