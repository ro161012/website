"use client";

import { Glass } from "@/components/glass/glass";
import { EmptyState, Skeleton } from "@/components/ui/ui";
import type {
  AssignmentWithCourse,
  Course,
  CourseSummary,
  MeData,
  Snapshot,
} from "@/lib/types";
import type { AppSettings } from "@/lib/client/storage";
import type { SnapshotDiff } from "@/lib/client/insights";
import { formatDelta } from "@/lib/client/insights";
import { gradeTone } from "@/lib/client/grades";
import { formatPoints, formatShortDate, relativeDue } from "@/components/workspace/format";
import styles from "./app.module.css";

export function HomeScreen({
  me,
  courses,
  upcoming,
  missing,
  overall,
  gpa,
  settings,
  snapshots,
  recentDiff,
  refreshing,
  lastUpdated,
  onRefresh,
  onOpenCourse,
}: {
  me: MeData;
  courses: CourseSummary[] | null;
  upcoming: AssignmentWithCourse[] | null;
  missing: Array<{ course: CourseSummary; assignment: Course["assignments"][number] }>;
  overall: number | null;
  gpa: { gpa: number | null; credits: number; counted: number };
  settings: AppSettings;
  snapshots: Snapshot[];
  recentDiff: SnapshotDiff;
  refreshing: boolean;
  lastUpdated: string | null;
  onRefresh: () => void;
  onOpenCourse: (courseId: string) => void;
}) {
  const period = me.markingPeriods.find((item) => item.id === me.activeMarkingPeriodId);
  const current = me.markingPeriods.find((item) => item.isCurrent) ?? period;
  const tone = gradeTone(overall, settings.thresholds);
  const nextWeek = (upcoming ?? []).filter((assignment) => {
    if (!assignment.dueDate) return false;
    const due = new Date(`${assignment.dueDate}T12:00:00`).getTime();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due >= today.getTime() && due <= today.getTime() + 7 * 86_400_000;
  });
  const loaded = courses !== null;
  const missingCount = missing.length;

  return (
    <div className={styles.page}>
      <div className={styles.pageIntro}>
        <div>
          <p className={styles.eyebrowLine}>
            <span aria-hidden="true" />
            {current?.name ?? "Current marking period"}
          </p>
          <p className={styles.lede}>
            A calm read of what is due, what changed, and where the record stands.
          </p>
        </div>
        <div className={styles.pageActions}>
          <span className={styles.stamp}>
            {lastUpdated
              ? `Updated ${new Date(lastUpdated).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : "Not synced"}
          </span>
          <button
            className={styles.secondaryButton}
            disabled={refreshing}
            onClick={onRefresh}
            type="button"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <Glass className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroMain}>
            <span className={styles.heroLabel}>Overall average</span>
            {loaded ? (
              <span className={`${styles.heroValue} ${styles[`tone_${tone}`] ?? ""}`}>
                {formatPoints(overall)}
                {overall !== null ? <span className={styles.heroUnit}>%</span> : null}
              </span>
            ) : (
              <span className={styles.heroSkeleton} />
            )}
            <span className={styles.heroNote}>
              {recentDiff.averageDelta === null
                ? "Your first snapshot is saved on this device."
                : `${formatDelta(recentDiff.averageDelta)} since the last visit`}
            </span>
          </div>

          <div className={styles.heroSide}>
            <span className={styles.heroLetter}>{current?.shortName ?? "MP"}</span>
            <span className={styles.heroSideLabel}>Marking period</span>
          </div>

          <div className={styles.heroMeta}>
            <span>
              <strong>{gpa.gpa ?? "—"}</strong> GPA
              <small>{settings.weightedGpa ? "weighted" : "unweighted"}</small>
            </span>
            <span>
              <strong>{courses?.length ?? "—"}</strong> courses
              <small>{gpa.credits || "—"} credits</small>
            </span>
            <span>
              <strong>{snapshots.length}</strong> snapshots
              <small>stored locally</small>
            </span>
          </div>
        </div>
      </Glass>

      <section aria-label="Quick statistics" className={styles.metrics}>
        <article className={styles.metric}>
          <span className={styles.metricLabel}>Courses</span>
          <span className={styles.metricValue}>{courses?.length ?? "—"}</span>
          <span className={styles.metricNote}>in this marking period</span>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricLabel}>Next 7 days</span>
          <span className={styles.metricValue}>{nextWeek.length}</span>
          <span className={styles.metricNote}>assignments due</span>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricLabel}>Missing</span>
          <span className={styles.metricValue}>{missingCount}</span>
          <span className={styles.metricNote}>visible in loaded courses</span>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricLabel}>GPA</span>
          <span className={styles.metricValue}>{gpa.gpa ?? "—"}</span>
          <span className={styles.metricNote}>
            {settings.weightedGpa ? "weighted" : "unweighted"} · {settings.gpaScale.toFixed(1)} scale
          </span>
        </article>
      </section>

      <div className={styles.twoColumn}>
        <section className={`${styles.panel} surface`} aria-labelledby="upcoming-title">
          <div className={styles.panelHead}>
            <div>
              <span className={styles.panelKicker}>The week ahead</span>
              <h2 className={styles.panelTitle} id="upcoming-title">
                Upcoming work
              </h2>
            </div>
            <span className={styles.panelCount}>{nextWeek.length}</span>
          </div>

          {upcoming === null ? (
            <Skeleton rows={4} />
          ) : nextWeek.length === 0 ? (
            <EmptyState
              body={
                courses === null
                  ? "Waiting for HAC to return this marking period."
                  : "No assignments are due in the next seven days."
              }
              title="A clear stretch"
            />
          ) : (
            <ul className={styles.list}>
              {nextWeek.map((assignment) => (
                <li className={styles.listRow} key={assignment.id}>
                  <span className={styles.dateBlock}>
                    <span className={styles.dateDay}>
                      {assignment.dueDate
                        ? formatShortDate(assignment.dueDate).split(" ")[1]
                        : "—"}
                    </span>
                    <span className={styles.dateMonth}>
                      {assignment.dueDate
                        ? formatShortDate(assignment.dueDate).split(" ")[0]
                        : "Date"}
                    </span>
                  </span>
                  <button
                    className={styles.rowMain}
                    onClick={() => onOpenCourse(assignment.courseId)}
                    type="button"
                  >
                    <span className={styles.rowTitle}>{assignment.name}</span>
                    <span className={styles.rowMeta}>{assignment.courseName}</span>
                  </button>
                  <span className={styles.rowSide}>
                    <span className={styles.rowWhen}>{relativeDue(assignment.dueDate)}</span>
                    {assignment.status !== "graded" ? (
                      <span className={`${styles.chip} ${styles[`status_${assignment.status}`] ?? ""}`}>
                        {assignment.status === "not_graded" ? "To do" : assignment.status}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${styles.panel} surface`} aria-labelledby="missing-title">
          <div className={styles.panelHead}>
            <div>
              <span className={styles.panelKicker}>Needs attention</span>
              <h2 className={styles.panelTitle} id="missing-title">
                Missing
              </h2>
            </div>
            <span className={styles.panelCount}>{missingCount}</span>
          </div>

          {courses === null ? (
            <Skeleton rows={3} />
          ) : missing.length === 0 ? (
            <EmptyState
              body="No missing assignments are visible in the courses loaded so far."
              title="Nothing missing"
            />
          ) : (
            <ul className={styles.list}>
              {missing.slice(0, 8).map(({ course, assignment }) => (
                <li className={styles.listRow} key={`${course.id}-${assignment.id}`}>
                  <span className={styles.missingMark} aria-hidden="true">
                    !
                  </span>
                  <button
                    className={styles.rowMain}
                    onClick={() => onOpenCourse(course.id)}
                    type="button"
                  >
                    <span className={styles.rowTitle}>{assignment.name}</span>
                    <span className={styles.rowMeta}>
                      {course.name}
                      {assignment.dueDate ? ` · due ${formatShortDate(assignment.dueDate)}` : ""}
                    </span>
                  </button>
                  <span className={styles.rowSide}>
                    <span className={styles.chipMissing}>0</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={`${styles.panel} surface`} aria-labelledby="snapshot-title">
        <div className={styles.panelHead}>
          <div>
            <span className={styles.panelKicker}>Since last visit</span>
            <h2 className={styles.panelTitle} id="snapshot-title">
              What changed
            </h2>
          </div>
          <span className={styles.muted}>
            {snapshots[0]
              ? new Date(snapshots[0].capturedAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "No snapshot yet"}
          </span>
        </div>
        <div className={styles.changeRow}>
          <span className={styles.changeValue}>{formatDelta(recentDiff.averageDelta)}</span>
          <span className={styles.changeArrow} aria-hidden="true">
            →
          </span>
          <span className={styles.muted}>
            {recentDiff.addedAssignments.length + recentDiff.changedAssignments.length} grade
            {recentDiff.addedAssignments.length + recentDiff.changedAssignments.length === 1
              ? ""
              : "s"}{" "}
            added or changed across the snapshots on this device.
          </span>
        </div>
      </section>
    </div>
  );
}
