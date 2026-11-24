"use client";

import type {
  Assignment,
  Category,
  Course,
  CourseLevel,
  CourseSummary,
} from "@/lib/types";
import type { AppSettings, GradeThresholds } from "./storage";

export interface ScoreEdit {
  score?: number | null;
  removed?: boolean;
}

export interface Hypothetical {
  id: string;
  categoryId: string | null;
  name: string;
  score: number;
  pointsPossible: number;
}

export interface ProjectedCategory {
  id: string;
  name: string;
  weightPercent: number | null;
  earned: number;
  possible: number;
  averagePercent: number | null;
}

export interface Projection {
  percent: number | null;
  categories: ProjectedCategory[];
  totalEarned: number;
  totalPossible: number;
  delta: number | null;
  weighted: boolean;
}

function finite(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function categoryBase(category: Category): { earned: number; possible: number } {
  const earned = finite(category.pointsEarned);
  const possible = finite(category.pointsPossible);
  if (earned !== null && possible !== null && possible > 0) return { earned, possible };
  const average = finite(category.averagePercent);
  return average !== null ? { earned: average, possible: 100 } : { earned: 0, possible: 0 };
}

function assignmentContribution(
  assignment: Assignment,
  edit: ScoreEdit | undefined,
): { earned: number; possible: number } | null {
  if (edit?.removed || assignment.status === "exempt") return null;
  const score = edit && "score" in edit ? finite(edit.score) : finite(assignment.score);
  const possible = finite(assignment.pointsPossible);
  if (score === null || possible === null || possible <= 0) return null;
  return { earned: score, possible };
}

/**
 * Recompute a course average from category weights while applying local
 * edits. Nothing in this module touches the network or HAC.
 */
export function projectCourse(
  course: Course,
  edits: Record<string, ScoreEdit> = {},
  hypotheticals: Hypothetical[] = [],
): Projection {
  const categories = course.categories.map((category) => {
    const assignments = course.assignments.filter(
      (assignment) => assignment.categoryId === category.id,
    );
    const base = assignments.length > 0 ? { earned: 0, possible: 0 } : categoryBase(category);

    const totals = assignments.reduce(
      (sum, assignment) => {
        const contribution = assignmentContribution(assignment, edits[assignment.id]);
        return contribution
          ? {
              earned: sum.earned + contribution.earned,
              possible: sum.possible + contribution.possible,
            }
          : sum;
      },
      { earned: 0, possible: 0 },
    );

    const earned = assignments.length > 0 ? totals.earned : base.earned;
    const possible = assignments.length > 0 ? totals.possible : base.possible;

    const extra = hypotheticals.reduce(
      (sum, item) => {
        if (item.categoryId !== category.id) return sum;
        return {
          earned: sum.earned + Math.max(0, item.score),
          possible: sum.possible + Math.max(0, item.pointsPossible),
        };
      },
      { earned: 0, possible: 0 },
    );

    const finalEarned = earned + extra.earned;
    const finalPossible = possible + extra.possible;

    return {
      id: category.id,
      name: category.name,
      weightPercent: category.weightPercent,
      earned: finalEarned,
      possible: finalPossible,
      averagePercent: finalPossible > 0 ? (finalEarned / finalPossible) * 100 : null,
    };
  });

  const weighted = categories.filter(
    (category) => (category.weightPercent ?? 0) > 0 && category.averagePercent !== null,
  );
  const weightTotal = weighted.reduce((sum, category) => sum + (category.weightPercent ?? 0), 0);

  let percent: number | null;
  if (weightTotal > 0) {
    percent =
      weighted.reduce(
        (sum, category) =>
          sum + (category.averagePercent ?? 0) * (category.weightPercent ?? 0),
        0,
      ) / weightTotal;
  } else {
    const totalEarned = categories.reduce((sum, category) => sum + category.earned, 0);
    const totalPossible = categories.reduce((sum, category) => sum + category.possible, 0);
    percent = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;
  }

  const current = finite(course.grade.percent);

  return {
    percent,
    categories,
    totalEarned: categories.reduce((sum, category) => sum + category.earned, 0),
    totalPossible: categories.reduce((sum, category) => sum + category.possible, 0),
    delta: percent !== null && current !== null ? percent - current : null,
    weighted: weightTotal > 0,
  };
}

/**
 * Score on one more 100-point assignment in `categoryId` that reaches `target`.
 * Returns null when the course has no usable weight/points structure.
 */
export function neededOnNextTest(
  projection: Projection,
  categoryId: string | null,
  target: number,
  pointsPossible = 100,
): number | null {
  if (!Number.isFinite(target) || target < 0 || target > 150) return null;

  const weighted = projection.categories.filter(
    (category) => (category.weightPercent ?? 0) > 0 && category.averagePercent !== null,
  );
  const weightTotal = weighted.reduce(
    (sum, category) => sum + (category.weightPercent ?? 0),
    0,
  );

  if (weightTotal > 0) {
    const category = projection.categories.find((item) => item.id === categoryId);
    if (!category || (category.weightPercent ?? 0) <= 0) return null;
    const weight = category.weightPercent ?? 0;
    const other = weighted
      .filter((item) => item.id !== category.id)
      .reduce(
        (sum, item) => sum + (item.averagePercent ?? 0) * (item.weightPercent ?? 0),
        0,
      );
    const requiredAverage = (target * weightTotal - other) / weight;
    if (requiredAverage < 0 || requiredAverage > 150) return null;
    const requiredScore =
      (requiredAverage / 100) * (category.possible + pointsPossible) - category.earned;
    return Math.round(requiredScore * 10) / 10;
  }

  const possible = projection.totalPossible;
  if (possible <= 0) return null;
  const score =
    (target / 100) * (possible + pointsPossible) - projection.totalEarned;
  return Math.round(score * 10) / 10;
}

const BASE_GPA: Array<{ min: number; points: number }> = [
  { min: 93, points: 4 },
  { min: 90, points: 3.7 },
  { min: 87, points: 3.3 },
  { min: 83, points: 3 },
  { min: 80, points: 2.7 },
  { min: 77, points: 2.3 },
  { min: 73, points: 2 },
  { min: 70, points: 1.7 },
  { min: 67, points: 1.3 },
  { min: 65, points: 1 },
  { min: 60, points: 0.7 },
  { min: 0, points: 0 },
];

export function gpaPointsForPercent(percent: number | null, scale: 4 | 5): number | null {
  if (percent === null || !Number.isFinite(percent)) return null;
  const base = BASE_GPA.find((step) => percent >= step.min)?.points ?? 0;
  return scale === 5 ? Math.min(5, base + 1) : base;
}

export function gpaForCourse(
  course: Pick<CourseSummary, "grade" | "level" | "credits">,
  settings: Pick<AppSettings, "gpaScale" | "levelWeights">,
  weighted: boolean,
): { points: number | null; credits: number } {
  const points = gpaPointsForPercent(course.grade.percent, settings.gpaScale);
  if (points === null) return { points: null, credits: 0 };
  const bonus = weighted ? settings.levelWeights[course.level] ?? 0 : 0;
  return {
    points: Math.min(settings.gpaScale, points + bonus),
    credits: course.credits && course.credits > 0 ? course.credits : 1,
  };
}

export function calculateGpa(
  courses: CourseSummary[],
  settings: Pick<AppSettings, "gpaScale" | "levelWeights">,
  weighted: boolean,
): { gpa: number | null; credits: number; counted: number } {
  let quality = 0;
  let credits = 0;
  let counted = 0;

  for (const course of courses) {
    const value = gpaForCourse(course, settings, weighted);
    if (value.points === null) continue;
    quality += value.points * value.credits;
    credits += value.credits;
    counted += 1;
  }

  return {
    gpa: credits > 0 ? Math.round((quality / credits) * 100) / 100 : null,
    credits: Math.round(credits * 100) / 100,
    counted,
  };
}

export interface RrisdGpaRow {
  average: number;
  credits: number;
  /** Advanced rows use the 6.0 ceiling; regular and dual-credit rows use 5.0. */
  weighted: boolean;
  /** Weighted GPA only counts rows with this flag. Unweighted counts every row. */
  affectsGpa: boolean;
}

export interface RrisdGpaResult {
  weighted: number | null;
  unweighted: number | null;
  weightedCredits: number;
  unweightedCredits: number;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function usableCredits(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0.5;
}

/**
 * RRISD weighted honor points, matching gpa.ruhangupta.com: the ceiling is
 * 6.0 for advanced courses and 5.0 for everything else, minus one point for
 * every ten points below 100. Grades below 70 earn no points.
 */
export function rrisdWeightedPoints(
  average: number,
  weighted: boolean,
): number {
  const value = clampPercent(average);
  if (value < 70) return 0;
  return Math.round(((weighted ? 6 : 5) - (100 - value) / 10) * 1000) / 1000;
}

/** Standard unweighted honor points: 4 / 3 / 2 / 0 by ten-point band. */
export function rrisdUnweightedPoints(average: number): number {
  const value = clampPercent(average);
  if (value >= 90) return 4;
  if (value >= 80) return 3;
  if (value >= 70) return 2;
  return 0;
}

/**
 * Calculate the weighted and unweighted GPA the way the RRISD calculator
 * does. Weighted credit is only earned by rows marked `affectsGpa`, while
 * the unweighted total averages every row that has an average.
 */
export function calculateRrisdGpa(rows: RrisdGpaRow[]): RrisdGpaResult {
  let weightedQuality = 0;
  let weightedCredits = 0;
  let unweightedQuality = 0;
  let unweightedCredits = 0;

  for (const row of rows) {
    if (!Number.isFinite(row.average)) continue;
    const credits = usableCredits(row.credits);

    unweightedQuality += rrisdUnweightedPoints(row.average) * credits;
    unweightedCredits += credits;

    if (row.affectsGpa) {
      weightedQuality += rrisdWeightedPoints(row.average, row.weighted) * credits;
      weightedCredits += credits;
    }
  }

  return {
    weighted:
      weightedCredits > 0
        ? Math.round((weightedQuality / weightedCredits) * 1000) / 1000
        : null,
    unweighted:
      unweightedCredits > 0
        ? Math.round((unweightedQuality / unweightedCredits) * 1000) / 1000
        : null,
    weightedCredits: Math.round(weightedCredits * 100) / 100,
    unweightedCredits: Math.round(unweightedCredits * 100) / 100,
  };
}

export function averagePercent(courses: CourseSummary[]): number | null {
  const values = courses
    .map((course) => course.grade.percent)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export type GradeTone = "a" | "b" | "c" | "d" | "f" | "none";

export function gradeTone(
  percent: number | null,
  thresholds: GradeThresholds,
): GradeTone {
  if (percent === null || !Number.isFinite(percent)) return "none";
  if (percent >= thresholds.a) return "a";
  if (percent >= thresholds.b) return "b";
  if (percent >= thresholds.c) return "c";
  if (percent >= thresholds.d) return "d";
  return "f";
}

export function levelLabel(level: CourseLevel): string {
  const labels: Record<CourseLevel, string> = {
    regular: "Regular",
    honors: "Honors",
    ap: "AP",
    ib: "IB",
    dual_enrollment: "Dual enrollment",
    other: "Other",
    unknown: "Course",
  };
  return labels[level];
}
