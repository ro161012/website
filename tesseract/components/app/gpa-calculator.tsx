"use client";

import { useMemo, useRef, useState } from "react";
import type { CourseSummary } from "@/lib/types";
import { calculateRrisdGpa } from "@/lib/client/grades";
import { formatPoints } from "@/components/workspace/format";
import styles from "./app.module.css";

interface CalculatorRow {
  id: string;
  name: string;
  average: string;
  credits: string;
  weighted: boolean;
  affectsGpa: boolean;
}

function isAdvanced(level: CourseSummary["level"]): boolean {
  return level === "ap" || level === "ib" || level === "honors";
}

function seedRows(courses: CourseSummary[]): CalculatorRow[] {
  return courses.map((course) => ({
    id: `hac-${course.id}`,
    name: course.name,
    average:
      course.grade.percent === null
        ? ""
        : String(Math.round(course.grade.percent * 10) / 10),
    credits: String(course.credits && course.credits > 0 ? course.credits : 1),
    weighted: isAdvanced(course.level),
    affectsGpa: true,
  }));
}

function formatGpa(value: number | null): string {
  return value === null ? "—" : value.toFixed(3);
}

/**
 * The RRISD calculator from gpa.ruhangupta.com, seeded with the courses HAC
 * already returned. Everything stays local: edits never touch the gradebook.
 */
export function GpaCalculator({
  courses,
  notify,
}: {
  courses: CourseSummary[];
  notify: (message: string) => void;
}) {
  const [rows, setRows] = useState<CalculatorRow[]>(() => seedRows(courses));
  const manualCounter = useRef(0);

  const calculation = useMemo(() => {
    const inputs = rows.flatMap((row) => {
      const average = Number(row.average);
      if (row.average.trim() === "" || !Number.isFinite(average)) return [];
      const credits = Number(row.credits);
      return [
        {
          average,
          credits: Number.isFinite(credits) ? credits : 0.5,
          weighted: row.weighted,
          affectsGpa: row.affectsGpa,
        },
      ];
    });
    return calculateRrisdGpa(inputs);
  }, [rows]);

  const counted = rows.filter((row) => {
    if (row.average.trim() === "") return false;
    return Number.isFinite(Number(row.average));
  }).length;

  const update = (id: string, patch: Partial<CalculatorRow>) => {
    setRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const remove = (id: string) => {
    setRows((previous) => previous.filter((row) => row.id !== id));
  };

  const addRow = () => {
    manualCounter.current += 1;
    setRows((previous) => [
      ...previous,
      {
        id: `manual-${manualCounter.current}`,
        name: "New course",
        average: "",
        credits: "1",
        weighted: false,
        affectsGpa: true,
      },
    ]);
  };

  const importFromHac = () => {
    setRows(seedRows(courses));
    notify(
      courses.length > 0
        ? `Imported ${courses.length} course${courses.length === 1 ? "" : "s"} from HAC`
        : "HAC returned no courses for this marking period",
    );
  };

  const copySummary = async () => {
    const summary = `Weighted ${formatGpa(calculation.weighted)} · Unweighted ${formatGpa(
      calculation.unweighted,
    )} · RRISD 6.0 scale · Tesseract`;
    try {
      await navigator.clipboard.writeText(summary);
      notify("GPA summary copied");
    } catch {
      notify("Clipboard is unavailable");
    }
  };

  return (
    <div className={styles.gpaCalculator}>
      <div className={styles.gpaTotals}>
        <article className={styles.gpaTotalCard}>
          <span className={styles.metricLabel}>
            Weighted GPA <span className={styles.gpaScale}>6.0</span>
          </span>
          <span className={styles.gpaTotalValue}>
            {formatGpa(calculation.weighted)}
          </span>
          <span className={styles.gpaTotalMeta}>
            {counted} rows · {formatPoints(calculation.weightedCredits)} credits
          </span>
        </article>

        <article className={styles.gpaTotalCard}>
          <span className={styles.metricLabel}>
            Unweighted GPA <span className={styles.gpaScale}>4.0</span>
          </span>
          <span className={styles.gpaTotalValue}>
            {formatGpa(calculation.unweighted)}
          </span>
          <span className={styles.gpaTotalMeta}>
            {counted} rows · {formatPoints(calculation.unweightedCredits)} credits
          </span>
        </article>
      </div>

      <div className={styles.gpaToolbar}>
        <button className={styles.secondaryButton} onClick={addRow} type="button">
          Add course
        </button>
        <button
          className={styles.primarySmall}
          disabled={courses.length === 0}
          onClick={importFromHac}
          type="button"
        >
          Import from HAC
        </button>
        <button className={styles.textButton} onClick={() => void copySummary()} type="button">
          Copy summary
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.gpaTable}`}>
          <caption className="sr-only">RRISD GPA calculator</caption>
          <thead>
            <tr>
              <th scope="col">Course</th>
              <th className={styles.num} scope="col">
                Average
              </th>
              <th className={styles.num} scope="col">
                Credits
              </th>
              <th scope="col">Weighting</th>
              <th scope="col">Affects GPA</th>
              <th scope="col">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    aria-label="Course name"
                    className={`${styles.input} ${styles.gpaCourseInput}`}
                    onChange={(event) => update(row.id, { name: event.target.value })}
                    type="text"
                    value={row.name}
                  />
                </td>
                <td className={styles.num}>
                  <input
                    aria-label={`${row.name || "Course"} average`}
                    className={`${styles.input} ${styles.gpaCellInput}`}
                    max={100}
                    min={0}
                    onChange={(event) => update(row.id, { average: event.target.value })}
                    placeholder="—"
                    step={0.1}
                    type="number"
                    value={row.average}
                  />
                </td>
                <td className={styles.num}>
                  <input
                    aria-label={`${row.name || "Course"} credits`}
                    className={`${styles.input} ${styles.gpaCreditsInput}`}
                    max={2}
                    min={0.5}
                    onChange={(event) => update(row.id, { credits: event.target.value })}
                    step={0.25}
                    type="number"
                    value={row.credits}
                  />
                </td>
                <td>
                  <select
                    aria-label={`${row.name || "Course"} weighting`}
                    className={`${styles.input} ${styles.gpaSelect}`}
                    onChange={(event) =>
                      update(row.id, { weighted: event.target.value === "advanced" })
                    }
                    value={row.weighted ? "advanced" : "regular"}
                  >
                    <option value="regular">Regular · 5.0</option>
                    <option value="advanced">Advanced · 6.0</option>
                  </select>
                </td>
                <td>
                  <input
                    aria-label={`${row.name || "Course"} affects GPA`}
                    checked={row.affectsGpa}
                    className={styles.gpaCheck}
                    onChange={(event) =>
                      update(row.id, { affectsGpa: event.target.checked })
                    }
                    type="checkbox"
                  />
                </td>
                <td>
                  <button
                    aria-label={`Remove ${row.name || "course"}`}
                    className={styles.gpaRemove}
                    onClick={() => remove(row.id)}
                    type="button"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className={styles.gpaEmpty}>
          No rows yet. Add a course, or import the courses HAC returned for this
          marking period.
        </p>
      ) : null}

      <p className={styles.panelNote}>
        Matches the RRISD 6.0 calculator: advanced courses earn up to 6.0 and
        regular or dual-credit courses up to 5.0, minus 0.1 for each point below
        100. Grades below 70 earn 0. Weighted totals only include rows marked
        Affects GPA; unweighted includes every row.
      </p>
    </div>
  );
}
