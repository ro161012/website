"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Category, Course, CourseSummary } from "@/lib/types";
import { apiGet, errorMessage, SessionLostError } from "./api";
import {
  averageOf,
  formatPercent,
  formatPoints,
  formatShortDate,
  letterForPercent,
} from "./format";
import styles from "@/app/dashboard/dashboard.module.css";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; data: Course }
  | { status: "error"; message: string };

const LEVEL_LABELS: Record<CourseSummary["level"], string> = {
  regular: "Regular",
  honors: "Honors",
  ap: "AP",
  ib: "IB",
  dual_enrollment: "Dual enrollment",
  other: "Other",
  unknown: "Course",
};

const STATUS_LABELS: Record<Course["assignments"][number]["status"], string> = {
  graded: "Graded",
  missing: "Missing",
  late: "Late",
  exempt: "Exempt",
  not_graded: "Not graded",
  unknown: "Unknown",
};

const STATUS_CLASS: Record<
  Course["assignments"][number]["status"],
  string | undefined
> = {
  graded: styles.statusGraded,
  missing: styles.statusMissing,
  late: styles.statusLate,
  exempt: styles.statusExempt,
  not_graded: styles.statusNotGraded,
  unknown: styles.statusUnknown,
};

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  const width = 280;
  const height = 68;
  const padding = 7;
  const low = Math.max(0, Math.min(...values) - 4);
  const high = Math.min(100, Math.max(...values) + 4);
  const span = Math.max(1, high - low);

  const coordinates: Array<[number, number]> = values.map((value, index) => [
    padding + (index * (width - padding * 2)) / (values.length - 1),
    height - padding - ((value - low) / span) * (height - padding * 2),
  ]);

  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (!first || !last) return null;

  const line = coordinates
    .map(
      ([x, y], index) =>
        `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${last[0].toFixed(1)},${height - padding} L${first[0].toFixed(1)},${height - padding} Z`;

  return (
    <svg
      aria-hidden="true"
      className={styles.sparkline}
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      <path className={styles.sparkArea} d={area} />
      <path className={styles.sparkLine} d={line} />
      {coordinates.map(([x, y], index) => (
        <circle
          className={styles.sparkPoint}
          cx={x}
          cy={y}
          key={index}
          r={index === coordinates.length - 1 ? 2.6 : 1.6}
        />
      ))}
    </svg>
  );
}

function weightedProjection(
  categories: Category[],
  overrides: Record<string, number>,
): { value: number; weightTotal: number } | null {
  const adjustable = categories.filter(
    (category) =>
      (category.weightPercent ?? 0) > 0 && category.averagePercent !== null,
  );
  const weightTotal = adjustable.reduce(
    (sum, category) => sum + (category.weightPercent ?? 0),
    0,
  );
  if (weightTotal <= 0) return null;

  const earned = adjustable.reduce((sum, category) => {
    const weight = category.weightPercent ?? 0;
    const value = overrides[category.id] ?? category.averagePercent ?? 0;
    return sum + value * weight;
  }, 0);

  return { value: earned / weightTotal, weightTotal };
}

export function CoursePanel({
  course,
  markingPeriodId,
  onClose,
}: {
  course: CourseSummary;
  markingPeriodId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const query = markingPeriodId
      ? `?mp=${encodeURIComponent(markingPeriodId)}`
      : "";

    apiGet<Course>(
      `/api/courses/${encodeURIComponent(course.id)}${query}`,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setState({ status: "ready", data: result.data });
        }
      })
      .catch((problem: unknown) => {
        if (controller.signal.aborted) return;
        if (problem instanceof SessionLostError) {
          router.replace("/?expired=1");
          router.refresh();
          return;
        }
        setState({ status: "error", message: errorMessage(problem) });
      });

    return () => controller.abort();
  }, [course.id, markingPeriodId, reload, router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className={styles.drawerBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        aria-labelledby="course-panel-title"
        aria-modal="true"
        className={styles.drawer}
        role="dialog"
      >
        <header className={styles.drawerHead}>
          <div>
            <p className={styles.drawerEyebrow}>
              {LEVEL_LABELS[course.level]}
              {course.period ? ` · Period ${course.period}` : ""}
            </p>
            <h2 className={styles.drawerTitle} id="course-panel-title">
              {course.name}
            </h2>
            <p className={styles.drawerMeta}>
              {[
                course.teacher?.name,
                course.room,
                course.credits ? `${formatPoints(course.credits)} credit` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button
            aria-label="Close course details"
            className={styles.drawerClose}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className={styles.drawerBody}>
          {state.status === "loading" ? (
            <div aria-hidden="true" className={styles.drawerSkeleton}>
              <span className={styles.skeletonWide} />
              <span className={styles.skeletonWide} />
              <span className={styles.skeletonWide} />
            </div>
          ) : state.status === "error" ? (
            <div className={styles.emptyState} role="alert">
              <span className={styles.emptyTitle}>Course unavailable</span>
              <span>{state.message}</span>
              <button
                className={styles.panelAction}
                onClick={() => {
                  setState({ status: "loading" });
                  setOverrides({});
                  setReload((value) => value + 1);
                }}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : (
            <CourseDetail
              course={state.data}
              onOverridesChange={setOverrides}
              overrides={overrides}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function CourseDetail({
  course,
  overrides,
  onOverridesChange,
}: {
  course: Course;
  overrides: Record<string, number>;
  onOverridesChange: (overrides: Record<string, number>) => void;
}) {
  const assignments = [...course.assignments].sort(
    (a, b) =>
      (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
      a.position - b.position,
  );
  const graded = assignments.filter(
    (assignment) => assignment.percent !== null && assignment.status !== "exempt",
  );
  const trendValues = graded
    .map((assignment) => assignment.percent)
    .filter((value): value is number => value !== null);
  const recentAverage = averageOf(
    graded.slice(-3).map((assignment) => assignment.percent),
  );
  const previousAverage = averageOf(
    graded.slice(-6, -3).map((assignment) => assignment.percent),
  );
  const trendDelta =
    recentAverage !== null && previousAverage !== null
      ? recentAverage - previousAverage
      : null;

  const projection = weightedProjection(course.categories, overrides);
  const changed = Object.keys(overrides).length > 0;

  return (
    <div className={styles.detailStack}>
      <section className={styles.gradeHero}>
        <div className={styles.gradeHeroMain}>
          <span className={styles.gradeHeroLabel}>Current grade</span>
          <span className={styles.gradeHeroValue}>
            {formatPoints(course.grade.percent)}
            {course.grade.percent !== null ? (
              <span className={styles.gradeHeroUnit}>%</span>
            ) : null}
          </span>
        </div>
        <span className={styles.gradeHeroLetter}>
          {course.grade.letter ?? "No letter yet"}
        </span>
        <div className={styles.gradeHeroMeta}>
          <span>
            Class average{" "}
            {course.classAverage ? formatPercent(course.classAverage.percent) : "—"}
          </span>
          <span>{assignments.length} assignments</span>
        </div>
      </section>

      <section className={styles.trendCard}>
        <div className={styles.trendHead}>
          <div>
            <h3 className={styles.subsectionTitle}>Assignment trend</h3>
            <p className={styles.trendNote}>
              {trendDelta === null
                ? "Not enough graded work for a comparison yet."
                : `${trendDelta >= 0 ? "+" : ""}${formatPoints(
                    trendDelta,
                  )} pts on the latest three vs the three before.`}
            </p>
          </div>
          <span className={styles.trendValue}>
            {formatPercent(recentAverage)}
          </span>
        </div>
        {trendValues.length >= 2 ? (
          <Sparkline values={trendValues} />
        ) : (
          <p className={styles.trendNote}>
            HAC has not exposed enough scored assignments to draw this line.
          </p>
        )}
      </section>

      <section className={styles.whatIf}>
        <div className={styles.whatIfTop}>
          <div>
            <h3 className={styles.subsectionTitle}>What if?</h3>
            <p className={styles.whatIfCopy}>
              Adjust a category average to see a local projection. Nothing is
              saved or sent to HAC.
            </p>
          </div>
          {changed ? (
            <button
              className={styles.resetButton}
              onClick={() => onOverridesChange({})}
              type="button"
            >
              Reset
            </button>
          ) : null}
        </div>

        {projection === null || course.categories.length === 0 ? (
          <p className={styles.whatIfCopy}>
            This course did not expose category weights, so Tesseract cannot make a
            trustworthy projection.
          </p>
        ) : (
          <>
            <div className={styles.whatIfGrid}>
              {course.categories.map((category) => {
                const weight = category.weightPercent ?? 0;
                if (weight <= 0 || category.averagePercent === null) return null;
                const value =
                  overrides[category.id] ??
                  Math.round(category.averagePercent * 10) / 10;

                return (
                  <label className={styles.whatIfRow} key={category.id}>
                    <span>
                      <span className={styles.whatIfName}>{category.name}</span>
                      <span className={styles.whatIfWeight}>
                        {formatPoints(weight)}% of grade
                      </span>
                    </span>
                    <span className={styles.whatIfInputWrap}>
                      <input
                        aria-label={`${category.name} hypothetical average`}
                        className={styles.whatIfInput}
                        max={150}
                        min={0}
                        onChange={(event) => {
                          const raw = event.target.value;
                          const next = { ...overrides };
                          if (raw === "") {
                            delete next[category.id];
                          } else {
                            const parsed = Number(raw);
                            if (Number.isFinite(parsed)) {
                              next[category.id] = Math.max(
                                0,
                                Math.min(150, parsed),
                              );
                            }
                          }
                          onOverridesChange(next);
                        }}
                        step={1}
                        type="number"
                        value={value}
                      />
                      <span aria-hidden="true" className={styles.whatIfPercent}>
                        %
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className={styles.projectedRow}>
              <div>
                <span className={styles.projectedLabel}>Projected average</span>
                <span className={styles.projectedValue}>
                  {formatPercent(projection.value)}
                </span>
              </div>
              <div className={styles.projectedSide}>
                <span className={styles.projectedLetter}>
                  {letterForPercent(projection.value)}
                </span>
                <span className={styles.projectedNote}>
                  {changed && course.grade.percent !== null
                    ? `${projection.value - course.grade.percent >= 0 ? "+" : ""}${formatPoints(
                        projection.value - course.grade.percent,
                      )} pts vs current`
                    : "Estimate from category weights"}
                </span>
              </div>
            </div>
          </>
        )}
      </section>

      <section>
        <h3 className={styles.subsectionTitle}>Categories</h3>
        {course.categories.length === 0 ? (
          <p className={styles.whatIfCopy}>
            HAC did not expose category weights for this course.
          </p>
        ) : (
          <div className={styles.categoryGrid}>
            {course.categories.map((category) => (
              <div className={styles.categoryCard} key={category.id}>
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
                <span className={styles.categoryBar}>
                  <span
                    className={styles.categoryBarFill}
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, category.averagePercent ?? 0),
                      )}%`,
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className={styles.subsectionTitle}>Assignments</h3>
        {assignments.length === 0 ? (
          <p className={styles.whatIfCopy}>
            No assignments came back for this course.
          </p>
        ) : (
          <div className={styles.assignmentList}>
            {assignments.map((assignment) => (
              <article className={styles.assignmentRow} key={assignment.id}>
                <div className={styles.assignmentMain}>
                  <span className={styles.assignmentName}>
                    {assignment.name}
                  </span>
                  <span className={styles.assignmentMeta}>
                    {assignment.dueDate
                      ? formatShortDate(assignment.dueDate)
                      : "No due date"}
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
                    {assignment.score !== null &&
                    assignment.pointsPossible !== null
                      ? `${formatPoints(assignment.score)} / ${formatPoints(
                          assignment.pointsPossible,
                        )}`
                      : assignment.status === "exempt"
                        ? "Exempt"
                        : "—"}
                  </span>
                  <span className={styles.assignmentPercent}>
                    {formatPercent(assignment.percent)}
                  </span>
                  <span
                    className={`${styles.statusChip} ${
                      STATUS_CLASS[assignment.status]
                    }`}
                  >
                    {STATUS_LABELS[assignment.status]}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
