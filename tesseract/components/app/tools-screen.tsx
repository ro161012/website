"use client";

import { useEffect, useState } from "react";
import type { Course, CourseSummary } from "@/lib/types";
import { apiGet, errorMessage, SessionLostError } from "@/components/workspace/api";
import { EmptyState, Skeleton } from "@/components/ui/ui";
import { GpaCalculator } from "./gpa-calculator";
import { WhatIf } from "./what-if";
import styles from "./app.module.css";

export function ToolsScreen({
  courses,
  details,
  markingPeriod,
  notify,
  onSessionLost,
}: {
  courses: CourseSummary[];
  details: Record<string, Course>;
  markingPeriod: string | null;
  notify: (message: string) => void;
  onSessionLost: () => void;
}) {
  const [courseId, setCourseId] = useState("");
  const [detail, setDetail] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeCourseId = courseId || courses[0]?.id || "";
  const cachedDetail = details[activeCourseId] ?? null;
  const activeDetail = detail?.id === activeCourseId ? detail : cachedDetail;
  const loading = !error && activeDetail === null;

  useEffect(() => {
    if (!activeCourseId) return;
    // The shell may already have this detail from its idle prefetch.
    if (details[activeCourseId]) return;
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
  }, [activeCourseId, details, markingPeriod, onSessionLost]);

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
            <span className={styles.panelKicker}>RRISD · weighted 6.0</span>
            <h2 className={styles.panelTitle} id="gpa-title">
              GPA calculator
            </h2>
          </div>
          <span className={styles.stamp}>Weighted & unweighted</span>
        </div>

        {courses.length === 0 ? (
          <EmptyState
            body="No courses are loaded for this marking period."
            title="Nothing to weight"
          />
        ) : (
          <GpaCalculator
            courses={courses}
            key={markingPeriod ?? "current"}
            notify={notify}
          />
        )}
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
        ) : activeDetail ? (
          <WhatIf course={activeDetail} />
        ) : error ? (
          <EmptyState body={error ?? "That course could not be loaded."} title="Course unavailable" />
        ) : null}
      </section>
    </div>
  );
}
