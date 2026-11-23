"use client";

import { useEffect, useMemo, useState } from "react";
import type { Course, CourseSummary } from "@/lib/types";
import type { AppSettings } from "@/lib/client/storage";
import { apiGet, errorMessage, SessionLostError } from "@/components/workspace/api";
import {
  calculateGpa,
  gpaForCourse,
  levelLabel,
} from "@/lib/client/grades";
import { formatPercent, formatPoints } from "@/components/workspace/format";
import { EmptyState, Segmented, Skeleton } from "@/components/ui/ui";
import { WhatIf } from "./what-if";
import styles from "./app.module.css";

export function ToolsScreen({
  courses,
  markingPeriod,
  settings,
  notify,
  onOpenCourse,
  onSessionLost,
}: {
  courses: CourseSummary[];
  markingPeriod: string | null;
  settings: AppSettings;
  notify: (message: string) => void;
  onOpenCourse: (courseId: string) => void;
  onSessionLost: () => void;
}) {
  const [weighted, setWeighted] = useState(settings.weightedGpa);
  const [courseId, setCourseId] = useState("");
  const [detail, setDetail] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeCourseId = courseId || courses[0]?.id || "";
  const loading = !error && detail?.id !== activeCourseId;

  const gpa = useMemo(
    () => calculateGpa(courses, settings, weighted),
    [courses, settings, weighted],
  );

  useEffect(() => {
    if (!activeCourseId) return;
    let cancelled = false;
    const query = markingPeriod ? `?mp=${encodeURIComponent(markingPeriod)}` : "";
    apiGet<Course>(`/api/courses/${encodeURIComponent(activeCourseId)}${query}`)
      .then((result) => {
        if (cancelled) return;
        setDetail(result.data);
        setError(null);
      })
      .catch((problem: unknown) => {
        if (cancelled) return;
        if (problem instanceof SessionLostError) {
          onSessionLost();
          return;
        }
        setError(errorMessage(problem));
      });
    return () => {
      cancelled = true;
    };
  }, [activeCourseId, markingPeriod, onSessionLost]);

  async function copyGpa() {
    const summary = `${gpa.gpa ?? "—"} ${
      weighted ? "weighted" : "unweighted"
    } GPA · ${gpa.credits} credits · Tesseract`;
    try {
      await navigator.clipboard.writeText(summary);
      notify("GPA summary copied");
    } catch {
      notify("Clipboard is unavailable");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageIntro}>
        <div>
          <p className={styles.eyebrowLine}>
            <span aria-hidden="true" />
            Local calculators
          </p>
          <p className={styles.lede}>
            Plan a grade without changing HAC. Every calculation here runs in this
            browser and is discarded when you leave.
          </p>
        </div>
      </div>

      <section className={`${styles.panel} surface`} aria-labelledby="gpa-title">
        <div className={styles.panelHead}>
          <div>
            <span className={styles.panelKicker}>{settings.gpaScale.toFixed(1)} scale</span>
            <h2 className={styles.panelTitle} id="gpa-title">
              GPA calculator
            </h2>
          </div>
          <Segmented
            compact
            label="GPA weighting"
            onChange={(value) => setWeighted(value === "weighted")}
            options={[
              { id: "weighted", label: "Weighted" },
              { id: "unweighted", label: "Unweighted" },
            ]}
            value={weighted ? "weighted" : "unweighted"}
          />
        </div>

        <div className={styles.gpaHeader}>
          <div>
            <span className={styles.metricLabel}>{weighted ? "Weighted" : "Unweighted"} GPA</span>
            <span className={styles.gpaValue}>{gpa.gpa ?? "—"}</span>
          </div>
          <div className={styles.gpaMeta}>
            <span>
              <strong>{gpa.counted}</strong> courses counted
            </span>
            <span>
              <strong>{formatPoints(gpa.credits)}</strong> credits
            </span>
            <button className={styles.textButton} onClick={() => void copyGpa()} type="button">
              Copy summary
            </button>
          </div>
        </div>

        {courses.length === 0 ? (
          <EmptyState body="No courses are loaded for this marking period." title="Nothing to weight" />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="sr-only">GPA by course</caption>
              <thead>
                <tr>
                  <th scope="col">Course</th>
                  <th scope="col">Level</th>
                  <th className={styles.num} scope="col">
                    Percent
                  </th>
                  <th className={styles.num} scope="col">
                    Credits
                  </th>
                  <th className={styles.num} scope="col">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => {
                  const value = gpaForCourse(course, settings, weighted);
                  return (
                    <tr key={course.id}>
                      <td>
                        <button
                          className={styles.tableLink}
                          onClick={() => onOpenCourse(course.id)}
                          type="button"
                        >
                          {course.name}
                        </button>
                      </td>
                      <td>{levelLabel(course.level)}</td>
                      <td className={styles.num}>{formatPercent(course.grade.percent)}</td>
                      <td className={styles.num}>{formatPoints(value.credits)}</td>
                      <td className={styles.num}>{value.points ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.panelNote}>
          Honors/AP/IB bonuses and the 4.0/5.0 scale are editable in More →
          Settings → GPA.
        </p>
      </section>

      <section className={`${styles.panel} surface`} aria-labelledby="whatif-tool-title">
        <div className={styles.panelHead}>
          <div>
            <span className={styles.panelKicker}>Course planner</span>
            <h2 className={styles.panelTitle} id="whatif-tool-title">
              What-if calculator
            </h2>
          </div>
          <label className={styles.inlineControl}>
            <span>Course</span>
            <select
              disabled={courses.length === 0}
              onChange={(event) => {
                setCourseId(event.target.value);
                setDetail(null);
                setError(null);
              }}
              value={activeCourseId}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {courses.length === 0 ? (
          <EmptyState body="Load a marking period first." title="No course selected" />
        ) : loading ? (
          <Skeleton rows={4} />
        ) : error ? (
          <EmptyState body={error ?? "That course could not be loaded."} title="Course unavailable" />
        ) : detail ? (
          <WhatIf course={detail} />
        ) : null}
      </section>
    </div>
  );
}
