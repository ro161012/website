"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Course, CourseSummary, Snapshot } from "@/lib/types";
import type { AppSettings } from "@/lib/client/storage";
import { apiGet, errorMessage, SessionLostError } from "@/components/workspace/api";
import { diffSnapshots } from "@/lib/client/insights";
import { gradeTone, levelLabel } from "@/lib/client/grades";
import {
  averageOf,
  formatPercent,
  formatPoints,
  formatShortDate,
  letterForPercent,
} from "@/components/workspace/format";
import { EmptyState, LineChart, Skeleton, StatusChip } from "@/components/ui/ui";
import { Glass } from "@/components/glass/glass";
import { WhatIf } from "./what-if";
import styles from "./app.module.css";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; data: Course }
  | { status: "error"; message: string };

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CourseSheet({
  course,
  cached,
  markingPeriod,
  snapshots,
  settings,
  onClose,
  onLoaded,
  onSessionLost,
}: {
  course: CourseSummary;
  cached?: Course;
  markingPeriod: string | null;
  snapshots: Snapshot[];
  settings: AppSettings;
  onClose: () => void;
  onLoaded: (course: Course) => void;
  onSessionLost: () => void;
}) {
  const [state, setState] = useState<DetailState>(
    cached ? { status: "ready", data: cached } : { status: "loading" },
  );
  const [reload, setReload] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cached && reload === 0) return;
    const controller = new AbortController();
    const query = markingPeriod ? `?mp=${encodeURIComponent(markingPeriod)}` : "";
    apiGet<Course>(
      `/api/courses/${encodeURIComponent(course.id)}${query}`,
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", data: result.data });
        onLoaded(result.data);
      })
      .catch((problem: unknown) => {
        if (controller.signal.aborted) return;
        if (problem instanceof SessionLostError) {
          onSessionLost();
          return;
        }
        setState({ status: "error", message: errorMessage(problem) });
      });
    return () => controller.abort();
  }, [cached, course.id, markingPeriod, reload, onLoaded, onSessionLost]);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusable = (): HTMLElement[] => {
      const panel = sheetRef.current;
      if (!panel) return [];
      return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
        (element) => element.getClientRects().length > 0,
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = sheetRef.current;
      if (!panel) return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);

      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last?.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus && previousFocus !== document.body && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [onClose]);

  return (
    <div
      className={styles.sheetBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Glass
        aria-labelledby="course-sheet-title"
        aria-modal="true"
        className={styles.sheet}
        innerClassName={styles.sheetInner}
        role="dialog"
      >
        <div className={styles.sheetFocus} ref={sheetRef}>
          <div className={styles.sheetHead}>
            <div>
              <p className={styles.panelKicker}>
                {levelLabel(course.level)}
                {course.period ? ` · Period ${course.period}` : ""}
              </p>
              <h2 className={styles.sheetTitle} id="course-sheet-title">
                {course.name}
              </h2>
              <p className={styles.sheetMeta}>
                {[
                  course.teacher?.name,
                  course.room,
                  course.credits ? `${course.credits} credit` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button
              aria-label="Close course details"
              className={styles.iconButton}
              onClick={onClose}
              ref={closeRef}
              type="button"
            >
              ×
            </button>
          </div>

          <div className={styles.sheetBody}>
            {state.status === "loading" ? (
              <Skeleton rows={5} />
            ) : state.status === "error" ? (
              <EmptyState
                action={
                  <button
                    className={styles.secondaryButton}
                    onClick={() => {
                      setState({ status: "loading" });
                      setReload((value) => value + 1);
                    }}
                    type="button"
                  >
                    Try again
                  </button>
                }
                body={state.message}
                title="Course unavailable"
              />
            ) : (
              <CourseDetail
                course={state.data}
                settings={settings}
                snapshots={snapshots}
              />
            )}
          </div>
        </div>
      </Glass>
    </div>
  );
}

function CourseDetail({
  course,
  settings,
  snapshots,
}: {
  course: Course;
  settings: AppSettings;
  snapshots: Snapshot[];
}) {
  const assignments = useMemo(
    () =>
      [...course.assignments].sort(
        (a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.position - b.position,
      ),
    [course.assignments],
  );
  const tone = gradeTone(course.grade.percent, settings.thresholds);
  const graded = assignments.filter(
    (assignment) => assignment.percent !== null && assignment.status !== "exempt",
  );
  const trendDelta = useMemo(() => {
    const recent = averageOf(graded.slice(-3).map((assignment) => assignment.percent));
    const previous = averageOf(graded.slice(-6, -3).map((assignment) => assignment.percent));
    return recent !== null && previous !== null ? recent - previous : null;
  }, [graded]);
  const newIds = useMemo(() => {
    const diff = diffSnapshots(snapshots[1] ?? null, snapshots[0] ?? null);
    return new Set(
      [...diff.addedAssignments, ...diff.changedAssignments]
        .filter((item) => item.courseId === course.id)
        .map((item) => item.assignmentId),
    );
  }, [snapshots, course.id]);

  const trendPoints = useMemo(() => {
    const stored = [...snapshots]
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
      .map((snapshot) => {
        const row = snapshot.courses.find((item) => item.courseId === course.id);
        return row?.grade.percent != null
          ? { at: snapshot.capturedAt, value: row.grade.percent }
          : null;
      })
      .filter((point): point is { at: string; value: number } => point !== null);
    if (stored.length >= 2) return stored;
    return graded
      .filter(
        (assignment): assignment is typeof assignment & { dueDate: string } =>
          assignment.dueDate !== null,
      )
      .map((assignment) => ({
        at: `${assignment.dueDate}T12:00:00`,
        value: assignment.percent ?? 0,
      }))
      .filter((point) => point.value > 0);
  }, [snapshots, course.id, graded]);

  return (
    <div className={styles.detailStack}>
      <section className={styles.gradeHero}>
        <div>
          <span className={styles.metricLabel}>Current grade</span>
          <span className={`${styles.gradeHeroValue} ${styles[`tone_${tone}`] ?? ""}`}>
            {formatPoints(course.grade.percent)}
            {course.grade.percent !== null ? <small>%</small> : null}
          </span>
        </div>
        <span className={styles.gradeHeroLetter}>
          {course.grade.letter ?? letterForPercent(course.grade.percent)}
        </span>
        <div className={styles.gradeHeroMeta}>
          <span>Class average {course.classAverage ? formatPercent(course.classAverage.percent) : "—"}</span>
          <span>{assignments.length} assignments</span>
          <span>{course.categories.length} categories</span>
        </div>
      </section>

      <section className={styles.subsection}>
        <div className={styles.subsectionHead}>
          <div>
            <h3 className={styles.subsectionTitle}>Average over time</h3>
            <p className={styles.muted}>
              {trendDelta === null
                ? "Assignment scores and local snapshots make up this line."
                : `${trendDelta >= 0 ? "+" : ""}${formatPoints(
                    trendDelta,
                  )} pts on the latest three graded assignments vs the three before.`}
            </p>
          </div>
        </div>
        <LineChart points={trendPoints} title={`${course.name} average over time`} />
      </section>

      <section className={styles.subsection}>
        <h3 className={styles.subsectionTitle}>Categories</h3>
        {course.categories.length === 0 ? (
          <p className={styles.muted}>HAC did not expose category weights for this course.</p>
        ) : (
          <div className={styles.categoryList}>
            {course.categories.map((category) => (
              <div className={styles.categoryRow} key={category.id}>
                <div>
                  <span className={styles.categoryName}>{category.name}</span>
                  <span className={styles.categoryMeta}>
                    {category.weightPercent !== null
                      ? `${formatPoints(category.weightPercent)}% weight`
                      : "Weight not listed"}
                    {category.pointsPossible !== null
                      ? ` · ${formatPoints(category.pointsEarned)}/${formatPoints(
                          category.pointsPossible,
                        )} pts`
                      : ""}
                  </span>
                </div>
                <span className={styles.categoryAverage}>
                  {formatPercent(category.averagePercent)}
                </span>
                <span className={styles.bar}>
                  <span
                    className={styles.barFill}
                    style={{
                      width: `${Math.max(0, Math.min(100, category.averagePercent ?? 0))}%`,
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.subsection}>
        <div className={styles.subsectionHead}>
          <h3 className={styles.subsectionTitle}>Assignments</h3>
          <span className={styles.muted}>{assignments.length} total</span>
        </div>
        {assignments.length === 0 ? (
          <EmptyState body="HAC returned no assignments for this course." title="Nothing listed" />
        ) : (
          <div className={styles.assignmentList}>
            {assignments.map((assignment) => {
              const assignmentTone = gradeTone(assignment.percent, settings.thresholds);
              return (
                <article className={styles.assignmentRow} key={assignment.id}>
                  <div className={styles.assignmentMain}>
                    <span className={styles.rowTitle}>
                      {assignment.name}
                      {newIds.has(assignment.id) ? <span className={styles.newMark}>N</span> : null}
                    </span>
                    <span className={styles.rowMeta}>
                      {assignment.dueDate ? formatShortDate(assignment.dueDate) : "No due date"}
                      {assignment.categoryId
                        ? ` · ${
                            course.categories.find(
                              (category) => category.id === assignment.categoryId,
                            )?.name ?? "Category"
                          }`
                        : ""}
                      {assignment.isExtraCredit ? " · Extra credit" : ""}
                    </span>
                  </div>
                  <div className={styles.assignmentSide}>
                    <span className={styles.assignmentScore}>
                      {assignment.score !== null && assignment.pointsPossible !== null
                        ? `${formatPoints(assignment.score)} / ${formatPoints(
                            assignment.pointsPossible,
                          )}`
                        : assignment.status === "exempt"
                          ? "Exempt"
                          : "—"}
                    </span>
                    <span
                      className={
                        settings.colorCode
                          ? `${styles.assignmentPercent} ${styles[`tone_${assignmentTone}`] ?? ""}`
                          : styles.assignmentPercent
                      }
                    >
                      {formatPercent(assignment.percent)}
                    </span>
                    <StatusChip status={assignment.status} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <WhatIf course={course} />
    </div>
  );
}
