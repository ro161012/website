"use client";

import { useMemo, useState } from "react";
import type { CourseSummary, MeData, Snapshot } from "@/lib/types";
import type { AppSettings } from "@/lib/client/storage";
import {
  loadCoursePrefs,
  saveCoursePrefs,
  type CoursePrefs,
} from "@/lib/client/storage";
import { diffSnapshots } from "@/lib/client/insights";
import { calculateGpa, gradeTone, levelLabel } from "@/lib/client/grades";
import { formatPercent, formatPoints } from "@/components/workspace/format";
import { EmptyState, Skeleton } from "@/components/ui/ui";
import styles from "./app.module.css";

export function GradesScreen({
  me,
  courses,
  markingPeriod,
  overall,
  settings,
  snapshots,
  onOpenCourse,
}: {
  me: MeData;
  courses: CourseSummary[] | null;
  markingPeriod: string | null;
  overall: number | null;
  settings: AppSettings;
  snapshots: Snapshot[];
  onOpenCourse: (courseId: string) => void;
}) {
  const [prefs, setPrefs] = useState<CoursePrefs>(() =>
    loadCoursePrefs(me.student.id, markingPeriod),
  );
  const [customize, setCustomize] = useState(false);

  const updatePrefs = (next: CoursePrefs) => {
    setPrefs(next);
    saveCoursePrefs(me.student.id, markingPeriod, next);
  };

  const recentCourses = useMemo(() => {
    const diff = diffSnapshots(snapshots[1] ?? null, snapshots[0] ?? null);
    return new Set(
      [...diff.addedAssignments, ...diff.changedAssignments].map((item) => item.courseId),
    );
  }, [snapshots]);

  const ordered = useMemo(() => {
    const index = new Map(prefs.order.map((id, position) => [id, position]));
    return [...(courses ?? [])].sort((a, b) => {
      const left = index.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const right = index.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return left - right || a.position - b.position || a.name.localeCompare(b.name);
    });
  }, [courses, prefs.order]);

  const visible = ordered.filter((course) => !prefs.hidden.includes(course.id));
  const hidden = ordered.filter((course) => prefs.hidden.includes(course.id));

  const move = (courseId: string, delta: number) => {
    const ids = ordered.map((course) => course.id);
    const from = ids.indexOf(courseId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    updatePrefs({ ...prefs, order: next });
  };

  const toggleHidden = (courseId: string) => {
    const isHidden = prefs.hidden.includes(courseId);
    updatePrefs({
      ...prefs,
      hidden: isHidden
        ? prefs.hidden.filter((id) => id !== courseId)
        : [...prefs.hidden, courseId],
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageIntro}>
        <div>
          <p className={styles.eyebrowLine}>
            <span aria-hidden="true" />
            {settings.weightedGpa ? "Weighted" : "Unweighted"} view
          </p>
          <p className={styles.lede}>
            Every average is HAC&apos;s own. The letter, percent and color always
            say the same thing.
          </p>
        </div>
        <div className={styles.pageActions}>
          <button
            aria-pressed={customize}
            className={customize ? styles.primarySmall : styles.secondaryButton}
            onClick={() => setCustomize((value) => !value)}
            type="button"
          >
            {customize ? "Done customizing" : "Reorder & hide"}
          </button>
        </div>
      </div>

      <section className={`${styles.overallStrip} surface`} aria-label="Overall grades">
        <div>
          <span className={styles.metricLabel}>Overall average</span>
          <span className={styles.overallValue}>{formatPercent(overall)}</span>
        </div>
        <div>
          <span className={styles.metricLabel}>GPA</span>
          <span className={styles.overallValue}>
            {calculateGpa(courses ?? [], settings, settings.weightedGpa).gpa ?? "—"}
          </span>
        </div>
        <div>
          <span className={styles.metricLabel}>Visible courses</span>
          <span className={styles.overallValue}>{visible.length}</span>
        </div>
        <div>
          <span className={styles.metricLabel}>New activity</span>
          <span className={styles.overallValue}>{recentCourses.size}</span>
        </div>
      </section>

      {customize ? (
        <div className={styles.customizeBar}>
          <span>
            Use the up and down buttons to reorder, or hide a course from the main
            grid. Changes stay on this device.
          </span>
          {hidden.length > 0 ? (
            <button
              className={styles.textButton}
              onClick={() => updatePrefs({ ...prefs, hidden: [] })}
              type="button"
            >
              Show {hidden.length} hidden
            </button>
          ) : null}
        </div>
      ) : null}

      {courses === null ? (
        <Skeleton rows={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          body="HAC returned no visible courses for this marking period."
          title="No courses here"
        />
      ) : (
        <div className={styles.courseGrid}>
          {visible.map((course, index) => {
            const tone = gradeTone(course.grade.percent, settings.thresholds);
            const newCount = recentCourses.has(course.id) ? 1 : 0;
            return (
              <article className={styles.courseCard} key={course.id}>
                <button
                  className={styles.courseButton}
                  onClick={() => onOpenCourse(course.id)}
                  type="button"
                >
                  <span className={styles.courseTop}>
                    <span className={styles.courseTag}>{levelLabel(course.level)}</span>
                    <span className={styles.coursePeriod}>
                      {course.period ? `Period ${course.period}` : "Course"}
                    </span>
                  </span>
                  <span className={styles.courseName}>
                    {course.name}
                    {newCount > 0 ? (
                      <span className={styles.newDot} title="New activity since your last snapshot">
                        New
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.courseTeacher}>
                    {[course.teacher?.name, course.room ? `Room ${course.room}` : null]
                      .filter(Boolean)
                      .join(" · ") || "No teacher listed"}
                  </span>
                  <span className={styles.courseFoot}>
                    <span className={`${styles.gradeValue} ${styles[`tone_${tone}`] ?? ""}`}>
                      {formatPoints(course.grade.percent)}
                      {course.grade.percent !== null ? <small>%</small> : null}
                    </span>
                    <span className={styles.gradeLetter}>
                      {course.grade.letter ?? "No letter"}
                    </span>
                    <span className={styles.courseArrow} aria-hidden="true">
                      ↗
                    </span>
                  </span>
                </button>

                {customize ? (
                  <div className={styles.courseControls}>
                    <button
                      aria-label={`Move ${course.name} up`}
                      className={styles.iconButton}
                      disabled={index === 0}
                      onClick={() => move(course.id, -1)}
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Move ${course.name} down`}
                      className={styles.iconButton}
                      disabled={index === visible.length - 1 && hidden.length === 0}
                      onClick={() => move(course.id, 1)}
                      type="button"
                    >
                      ↓
                    </button>
                    <button
                      className={styles.textButton}
                      onClick={() => toggleHidden(course.id)}
                      type="button"
                    >
                      Hide
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {hidden.length > 0 ? (
        <section className={`${styles.panel} surface`} aria-labelledby="hidden-title">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle} id="hidden-title">
              Hidden courses
            </h2>
            <span className={styles.panelCount}>{hidden.length}</span>
          </div>
          <ul className={styles.list}>
            {hidden.map((course) => (
              <li className={styles.listRow} key={course.id}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{course.name}</span>
                  <span className={styles.rowMeta}>{formatPercent(course.grade.percent)}</span>
                </span>
                <button
                  className={styles.textButton}
                  onClick={() => toggleHidden(course.id)}
                  type="button"
                >
                  Show again
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
