"use client";

import { useMemo, useState } from "react";
import type { Course, CourseSummary, Snapshot } from "@/lib/types";
import {
  averageTrend,
  courseTrends,
  diffSnapshots,
  formatDelta,
} from "@/lib/client/insights";
import { EmptyState, LineChart, Segmented } from "@/components/ui/ui";
import { formatPoints, formatShortDate } from "@/components/workspace/format";
import styles from "./app.module.css";

type Range = "30" | "60" | "90";

export function InsightsScreen({
  courses,
  details,
  snapshots,
  onOpenCourse,
}: {
  courses: CourseSummary[];
  details: Record<string, Course>;
  snapshots: Snapshot[];
  onOpenCourse: (courseId: string) => void;
}) {
  const [range, setRange] = useState<Range>("30");
  const [courseId, setCourseId] = useState<string>("overall");

  const latestCapturedAt = useMemo(
    () =>
      snapshots.reduce(
        (latest, snapshot) => Math.max(latest, Date.parse(snapshot.capturedAt) || 0),
        0,
      ),
    [snapshots],
  );

  const points = useMemo(() => {
    if (courseId === "overall") {
      return averageTrend(snapshots, Number(range), latestCapturedAt || undefined);
    }
    const coursePoints = snapshots
      .filter(
        (snapshot) =>
          Date.parse(snapshot.capturedAt) >=
          latestCapturedAt - Number(range) * 86_400_000,
      )
      .map((snapshot) => {
        const row = snapshot.courses.find((course) => course.courseId === courseId);
        return row?.grade.percent != null
          ? { at: snapshot.capturedAt, value: row.grade.percent }
          : null;
      })
      .filter((point): point is { at: string; value: number } => point !== null)
      .sort((a, b) => a.at.localeCompare(b.at));
    return coursePoints;
  }, [snapshots, range, courseId, latestCapturedAt]);

  const trends = useMemo(() => courseTrends(snapshots), [snapshots]);
  const latestDiff = useMemo(
    () => diffSnapshots(snapshots[1] ?? null, snapshots[0] ?? null),
    [snapshots],
  );
  const recent = useMemo(() => {
    const rows: Array<{
      courseId: string;
      courseName: string;
      assignmentName: string;
      kind: "new" | "changed";
      dueDate: string | null;
    }> = [];
    for (const item of latestDiff.addedAssignments) {
      const course = courses.find((candidate) => candidate.id === item.courseId);
      const assignment = details[item.courseId]?.assignments.find(
        (candidate) => candidate.id === item.assignmentId,
      );
      rows.push({
        courseId: item.courseId,
        courseName: course?.name ?? "Course",
        assignmentName: assignment?.name ?? "New assignment",
        kind: "new",
        dueDate: assignment?.dueDate ?? null,
      });
    }
    for (const item of latestDiff.changedAssignments) {
      const course = courses.find((candidate) => candidate.id === item.courseId);
      const assignment = details[item.courseId]?.assignments.find(
        (candidate) => candidate.id === item.assignmentId,
      );
      rows.push({
        courseId: item.courseId,
        courseName: course?.name ?? "Course",
        assignmentName: assignment?.name ?? "Updated assignment",
        kind: "changed",
        dueDate: assignment?.dueDate ?? null,
      });
    }
    return rows;
  }, [latestDiff, courses, details]);

  return (
    <div className={styles.page}>
      <div className={styles.pageIntro}>
        <div>
          <p className={styles.eyebrowLine}>
            <span aria-hidden="true" />
            Snapshots stay on this device
          </p>
          <p className={styles.lede}>
            Tesseract compares compact snapshots taken when you open the app. No
            grade history is sent anywhere.
          </p>
        </div>
      </div>

      <div className={styles.toolbarRow}>
        <Segmented
          compact
          label="History range"
          onChange={setRange}
          options={[
            { id: "30", label: "30 days" },
            { id: "60", label: "60 days" },
            { id: "90", label: "90 days" },
          ]}
          value={range}
        />
        <label className={styles.inlineControl}>
          <span>Series</span>
          <select onChange={(event) => setCourseId(event.target.value)} value={courseId}>
            <option value="overall">Overall average</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.shortName ?? course.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {snapshots.length < 2 ? (
        <section className={`${styles.panel} surface`}>
          <EmptyState
            body="Insights needs at least two visits. The first snapshot is already saved; reopen Tesseract after your next grade update."
            title="Collecting history"
          />
        </section>
      ) : (
        <>
          <section className={`${styles.panel} surface`} aria-labelledby="trend-title">
            <div className={styles.panelHead}>
              <div>
                <span className={styles.panelKicker}>{range} day view</span>
                <h2 className={styles.panelTitle} id="trend-title">
                  {courseId === "overall"
                    ? "Overall average over time"
                    : courses.find((course) => course.id === courseId)?.name ?? "Course trend"}
                </h2>
              </div>
              <span className={styles.deltaPill}>{formatDelta(latestDiff.averageDelta)}</span>
            </div>
            <LineChart
              points={points}
              title="Average trend from local snapshots"
              valueLabel="Average"
            />
          </section>

          <div className={styles.twoColumn}>
            <section className={`${styles.panel} surface`} aria-labelledby="momentum-title">
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle} id="momentum-title">
                  Momentum
                </h2>
                <span className={styles.panelCount}>{trends.length}</span>
              </div>
              {trends.length === 0 ? (
                <EmptyState
                  body="No course has moved across the saved snapshots yet."
                  title="Steady"
                />
              ) : (
                <div className={styles.trendList}>
                  {[...trends]
                    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                    .slice(0, 8)
                    .map((trend) => (
                      <button
                        className={styles.trendRow}
                        key={trend.courseId}
                        onClick={() => onOpenCourse(trend.courseId)}
                        type="button"
                      >
                        <span className={styles.trendMain}>
                          <span className={styles.rowTitle}>{trend.courseName}</span>
                          <span className={styles.rowMeta}>
                            {formatPoints(trend.first)}% → {formatPoints(trend.last)}%
                          </span>
                        </span>
                        <span
                          className={
                            trend.delta >= 0 ? styles.deltaPositive : styles.deltaNegative
                          }
                        >
                          {formatDelta(trend.delta)}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </section>

            <section className={`${styles.panel} surface`} aria-labelledby="recent-title">
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle} id="recent-title">
                  Recently changed
                </h2>
                <span className={styles.panelCount}>
                  {latestDiff.addedAssignments.length + latestDiff.changedAssignments.length}
                </span>
              </div>
              {recent.length === 0 ? (
                <EmptyState
                  body="No new or changed assignment hashes since the previous snapshot."
                  title="No changes yet"
                />
              ) : (
                <ul className={styles.list}>
                  {recent.slice(0, 8).map((item, index) => (
                    <li className={styles.listRow} key={`${item.courseId}-${item.assignmentName}-${index}`}>
                      <span className={styles.newMark}>{item.kind === "new" ? "N" : "↻"}</span>
                      <button
                        className={styles.rowMain}
                        onClick={() => onOpenCourse(item.courseId)}
                        type="button"
                      >
                        <span className={styles.rowTitle}>{item.assignmentName}</span>
                        <span className={styles.rowMeta}>
                          {item.courseName}
                          {item.dueDate ? ` · ${formatShortDate(item.dueDate)}` : ""}
                        </span>
                      </button>
                      <span className={styles.chip}>{item.kind === "new" ? "New" : "Changed"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
