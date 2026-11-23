"use client";

import { useMemo, useState } from "react";
import type { Course } from "@/lib/types";
import {
  neededOnNextTest,
  projectCourse,
  type Hypothetical,
  type ScoreEdit,
} from "@/lib/client/grades";
import { formatPercent, formatPoints } from "@/components/workspace/format";
import styles from "./app.module.css";

export function WhatIf({ course }: { course: Course }) {
  const [edits, setEdits] = useState<Record<string, ScoreEdit>>({});
  const [hypotheticals, setHypotheticals] = useState<Hypothetical[]>([]);
  const [hypoName, setHypoName] = useState("Next test");
  const [hypoCategory, setHypoCategory] = useState(course.categories[0]?.id ?? "");
  const [hypoScore, setHypoScore] = useState("90");
  const [hypoPoints, setHypoPoints] = useState("100");
  const [targetCategory, setTargetCategory] = useState(course.categories[0]?.id ?? "");
  const [target, setTarget] = useState("90");

  const projection = useMemo(
    () => projectCourse(course, edits, hypotheticals),
    [course, edits, hypotheticals],
  );
  const changed =
    Object.keys(edits).length > 0 || hypotheticals.length > 0;
  const needed = neededOnNextTest(
    projection,
    targetCategory || null,
    Number(target),
  );
  const assignments = [...course.assignments].sort(
    (a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.position - b.position,
  );

  const updateScore = (assignmentId: string, raw: string) => {
    const next = { ...edits };
    if (raw === "") {
      delete next[assignmentId];
    } else {
      const value = Number(raw);
      if (Number.isFinite(value)) next[assignmentId] = { score: value };
    }
    setEdits(next);
  };

  const toggleRemoved = (assignmentId: string) => {
    const current = edits[assignmentId];
    setEdits({
      ...edits,
      [assignmentId]: { ...current, removed: !current?.removed },
    });
  };

  const addHypothetical = () => {
    const score = Number(hypoScore);
    const points = Number(hypoPoints);
    if (!Number.isFinite(score) || !Number.isFinite(points) || points <= 0) return;
    setHypotheticals((previous) => [
      ...previous,
      {
        id: `hypo-${Date.now()}-${previous.length}`,
        categoryId: hypoCategory || null,
        name: hypoName.trim() || "Hypothetical",
        score,
        pointsPossible: points,
      },
    ]);
    setHypoName("Next test");
  };

  return (
    <section className={styles.whatIf} aria-labelledby="what-if-title">
      <div className={styles.panelHead}>
        <div>
          <span className={styles.panelKicker}>Local only · nothing sent to HAC</span>
          <h2 className={styles.panelTitle} id="what-if-title">
            What if?
          </h2>
        </div>
        {changed ? (
          <button
            className={styles.textButton}
            onClick={() => {
              setEdits({});
              setHypotheticals([]);
            }}
            type="button"
          >
            Reset
          </button>
        ) : null}
      </div>

      {course.categories.length === 0 ? (
        <p className={styles.muted}>
          HAC did not expose categories or weights for this course, so a
          trustworthy projection is not possible.
        </p>
      ) : (
        <>
          <div className={styles.whatIfGrid}>
            <div className={styles.categoryList}>
              {projection.categories.map((category) => (
                <div className={styles.categoryRow} key={category.id}>
                  <div>
                    <span className={styles.categoryName}>{category.name}</span>
                    <span className={styles.categoryMeta}>
                      {category.weightPercent !== null
                        ? `${formatPoints(category.weightPercent)}% weight`
                        : "No weight"}
                      {category.possible > 0
                        ? ` · ${formatPoints(category.earned)}/${formatPoints(category.possible)} pts`
                        : ""}
                    </span>
                  </div>
                  <span className={styles.categoryAverage}>
                    {formatPercent(category.averagePercent)}
                  </span>
                </div>
              ))}
            </div>

            <div className={styles.projectionCard}>
              <span className={styles.metricLabel}>Projected average</span>
              <span className={styles.projectionValue}>{formatPercent(projection.percent)}</span>
              <span
                className={
                  (projection.delta ?? 0) >= 0 ? styles.deltaPositive : styles.deltaNegative
                }
              >
                {projection.delta === null
                  ? "No current average"
                  : `${projection.delta >= 0 ? "+" : ""}${formatPoints(
                      projection.delta,
                    )} pts vs HAC`}
              </span>
              <span className={styles.muted}>
                {projection.weighted
                  ? "Weighted by the category weights HAC exposes."
                  : "Points-based; no category weights were listed."}
              </span>
            </div>
          </div>

          <details className={styles.editDetails}>
            <summary>Edit assignment scores ({assignments.length})</summary>
            <div className={styles.editList}>
              {assignments.map((assignment) => {
                const edit = edits[assignment.id];
                const removed = edit?.removed === true;
                return (
                  <div
                    className={removed ? `${styles.editRow} ${styles.editRowRemoved}` : styles.editRow}
                    key={assignment.id}
                  >
                    <div className={styles.editMain}>
                      <span className={styles.rowTitle}>{assignment.name}</span>
                      <span className={styles.rowMeta}>
                        {assignment.categoryId
                          ? course.categories.find((category) => category.id === assignment.categoryId)
                              ?.name ?? "Category"
                          : "No category"}
                        {assignment.pointsPossible !== null
                          ? ` · ${formatPoints(assignment.pointsPossible)} pts possible`
                          : ""}
                      </span>
                    </div>
                    <input
                      aria-label={`${assignment.name} score`}
                      className={styles.scoreInput}
                      disabled={removed}
                      min={0}
                      onChange={(event) => updateScore(assignment.id, event.target.value)}
                      placeholder="—"
                      step={0.5}
                      type="number"
                      value={edit?.score ?? assignment.score ?? ""}
                    />
                    <button
                      className={styles.textButton}
                      onClick={() => toggleRemoved(assignment.id)}
                      type="button"
                    >
                      {removed ? "Restore" : "Remove"}
                    </button>
                  </div>
                );
              })}
            </div>
          </details>

          <div className={styles.hypoForm}>
            <span className={styles.fieldLabel}>Add a hypothetical</span>
            <div className={styles.hypoGrid}>
              <input
                aria-label="Hypothetical assignment name"
                className={styles.input}
                onChange={(event) => setHypoName(event.target.value)}
                placeholder="Next test"
                type="text"
                value={hypoName}
              />
              <select
                aria-label="Hypothetical category"
                className={styles.input}
                onChange={(event) => setHypoCategory(event.target.value)}
                value={hypoCategory}
              >
                {course.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input
                aria-label="Hypothetical score"
                className={styles.input}
                min={0}
                onChange={(event) => setHypoScore(event.target.value)}
                step={0.5}
                type="number"
                value={hypoScore}
              />
              <span className={styles.slash}>/</span>
              <input
                aria-label="Hypothetical points possible"
                className={styles.input}
                min={1}
                onChange={(event) => setHypoPoints(event.target.value)}
                step={1}
                type="number"
                value={hypoPoints}
              />
              <button className={styles.secondaryButton} onClick={addHypothetical} type="button">
                Add
              </button>
            </div>
            {hypotheticals.length > 0 ? (
              <ul className={styles.hypoList}>
                {hypotheticals.map((item) => (
                  <li key={item.id}>
                    <span>
                      <strong>{item.name}</strong> ·{" "}
                      {course.categories.find((category) => category.id === item.categoryId)?.name ??
                        "No category"}{" "}
                      · {item.score}/{item.pointsPossible}
                    </span>
                    <button
                      className={styles.textButton}
                      onClick={() =>
                        setHypotheticals((previous) =>
                          previous.filter((candidate) => candidate.id !== item.id),
                        )
                      }
                      type="button"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className={styles.targetBox}>
            <div>
              <span className={styles.fieldLabel}>What do I need on the next test?</span>
              <p className={styles.muted}>
                One more 100-point assignment in the chosen category. The rest of
                the course stays as it is.
              </p>
            </div>
            <div className={styles.targetControls}>
              <select
                aria-label="Category for the next test"
                className={styles.input}
                onChange={(event) => setTargetCategory(event.target.value)}
                value={targetCategory}
              >
                {course.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <label className={styles.targetInput}>
                <span>Target %</span>
                <input
                  className={styles.input}
                  max={150}
                  min={0}
                  onChange={(event) => setTarget(event.target.value)}
                  step={1}
                  type="number"
                  value={target}
                />
              </label>
            </div>
            <p className={styles.targetAnswer} role="status">
              {needed === null
                ? "That target is not reachable with one 100-point assignment in this category."
                : needed > 100
                  ? `You would need ${formatPoints(needed)} / 100 — above a perfect score.`
                  : `You need ${formatPoints(needed)} / 100 to reach ${formatPoints(
                      Number(target),
                    )}%.`}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
