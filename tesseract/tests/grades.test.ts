import { describe, expect, it } from "vitest";
import type { Course, CourseSummary } from "@/lib/types";
import {
  calculateGpa,
  calculateRrisdGpa,
  gpaForCourse,
  gradeTone,
  neededOnNextTest,
  projectCourse,
  rrisdUnweightedPoints,
  rrisdWeightedPoints,
  type Projection,
} from "@/lib/client/grades";

const COURSE: Course = {
  id: "course_algebra",
  markingPeriodId: "mp_2",
  name: "Algebra II",
  shortName: "Algebra II",
  teacher: null,
  period: "2",
  room: null,
  level: "honors",
  credits: 1,
  grade: { percent: 78, letter: "C+" },
  classAverage: null,
  position: 0,
  categories: [
    {
      id: "cat_practice",
      name: "Practice",
      weightPercent: 40,
      pointsEarned: null,
      pointsPossible: null,
      averagePercent: null,
      position: 0,
      assignmentIds: ["asg_a1", "asg_a2"],
    },
    {
      id: "cat_tests",
      name: "Tests",
      weightPercent: 60,
      pointsEarned: null,
      pointsPossible: null,
      averagePercent: null,
      position: 1,
      assignmentIds: ["asg_b1"],
    },
  ],
  assignments: [
    {
      id: "asg_a1",
      courseId: "course_algebra",
      categoryId: "cat_practice",
      name: "Warm-up",
      dueDate: "2026-09-10",
      assignedDate: null,
      score: 36,
      pointsPossible: 40,
      percent: 90,
      status: "graded",
      isExtraCredit: false,
      comment: null,
      position: 0,
    },
    {
      id: "asg_a2",
      courseId: "course_algebra",
      categoryId: "cat_practice",
      name: "Problem set",
      dueDate: "2026-09-12",
      assignedDate: null,
      score: 45,
      pointsPossible: 50,
      percent: 90,
      status: "graded",
      isExtraCredit: false,
      comment: null,
      position: 1,
    },
    {
      id: "asg_b1",
      courseId: "course_algebra",
      categoryId: "cat_tests",
      name: "Unit test",
      dueDate: "2026-09-20",
      assignedDate: null,
      score: 70,
      pointsPossible: 100,
      percent: 70,
      status: "graded",
      isExtraCredit: false,
      comment: null,
      position: 2,
    },
  ],
};

function summary(percent: number, level: CourseSummary["level"], credits = 1): CourseSummary {
  return {
    id: `course_${percent}_${level}`,
    markingPeriodId: "mp_2",
    name: "Course",
    shortName: null,
    teacher: null,
    period: null,
    room: null,
    level,
    credits,
    grade: { percent, letter: null },
    classAverage: null,
    position: 0,
  };
}

function projection(): Projection {
  return projectCourse(COURSE);
}

describe("course projection", () => {
  it("recomputes the weighted average from assignment totals", () => {
    const result = projection();
    expect(result.percent).toBeCloseTo(78, 5);
    expect(result.delta).toBeCloseTo(0, 5);
    expect(result.weighted).toBe(true);
    expect(result.categories[0]?.averagePercent).toBeCloseTo(90, 5);
    expect(result.categories[1]?.averagePercent).toBeCloseTo(70, 5);
  });

  it("applies a local score edit without touching the source course", () => {
    const result = projectCourse(COURSE, { asg_b1: { score: 100 } });
    expect(result.percent).toBeCloseTo(96, 5);
    expect(result.delta).toBeCloseTo(18, 5);
    expect(COURSE.assignments[2]?.score).toBe(70);
  });

  it("adds a hypothetical test to the matching category", () => {
    const result = projectCourse(COURSE, {}, [
      {
        id: "hypo_1",
        categoryId: "cat_tests",
        name: "Retake",
        score: 100,
        pointsPossible: 100,
      },
    ]);
    expect(result.categories[1]?.averagePercent).toBeCloseTo(85, 5);
    expect(result.percent).toBeCloseTo(87, 5);
  });

  it("solves the score needed for a target average", () => {
    const sixCategory = projectCourse(COURSE);
    expect(neededOnNextTest(sixCategory, "cat_tests", 80)).toBeCloseTo(76.7, 1);
    expect(neededOnNextTest(sixCategory, "cat_tests", 90)).toBeCloseTo(110, 1);
    expect(neededOnNextTest(sixCategory, "missing_category", 90)).toBeNull();
    expect(neededOnNextTest(sixCategory, "cat_tests", 151)).toBeNull();
  });
});

describe("GPA and grade tone", () => {
  const settings = {
    gpaScale: 4 as const,
    levelWeights: {
      regular: 0,
      honors: 0.5,
      ap: 1,
      ib: 1,
      dual_enrollment: 0.5,
      other: 0,
      unknown: 0,
    },
  };

  it("averages quality points by credit and applies level bonuses only when weighted", () => {
    const courses = [summary(93, "regular"), summary(87, "honors")];
    expect(calculateGpa(courses, settings, false)).toEqual({
      gpa: 3.65,
      credits: 2,
      counted: 2,
    });
    expect(calculateGpa(courses, settings, true)).toEqual({
      gpa: 3.9,
      credits: 2,
      counted: 2,
    });
  });

  it("returns null and zero credits when no course has a grade", () => {
    const courses = [summary(0, "regular")];
    courses[0] = { ...courses[0]!, grade: { percent: null, letter: null } };
    expect(calculateGpa(courses, settings, true)).toEqual({
      gpa: null,
      credits: 0,
      counted: 0,
    });
  });

  it("keeps a one-credit minimum for GPA weighting", () => {
    const course = { ...summary(95, "ap"), credits: null };
    expect(gpaForCourse(course, settings, true)).toEqual({ points: 4, credits: 1 });
  });

  it("maps RRISD weighted points to the 6.0 and 5.0 ceilings", () => {
    expect(rrisdWeightedPoints(100, true)).toBe(6);
    expect(rrisdWeightedPoints(100, false)).toBe(5);
    expect(rrisdWeightedPoints(90, true)).toBe(5);
    expect(rrisdWeightedPoints(90, false)).toBe(4);
    expect(rrisdWeightedPoints(70, true)).toBe(3);
    expect(rrisdWeightedPoints(69.9, true)).toBe(0);
  });

  it("maps RRISD unweighted points by ten-point band", () => {
    expect(rrisdUnweightedPoints(100)).toBe(4);
    expect(rrisdUnweightedPoints(90)).toBe(4);
    expect(rrisdUnweightedPoints(89.9)).toBe(3);
    expect(rrisdUnweightedPoints(80)).toBe(3);
    expect(rrisdUnweightedPoints(70)).toBe(2);
    expect(rrisdUnweightedPoints(69.9)).toBe(0);
  });

  it("calculates RRISD weighted and unweighted GPAs by attempted credit", () => {
    const result = calculateRrisdGpa([
      { average: 100, credits: 1, weighted: false, affectsGpa: true },
      { average: 80, credits: 1, weighted: true, affectsGpa: true },
      { average: 85, credits: 1, weighted: false, affectsGpa: false },
    ]);
    expect(result.weighted).toBeCloseTo(4.5, 5);
    expect(result.unweighted).toBeCloseTo(3.333, 3);
    expect(result.weightedCredits).toBe(2);
    expect(result.unweightedCredits).toBe(3);
  });

  it("returns null RRISD totals when no row has an average", () => {
    expect(calculateRrisdGpa([])).toEqual({
      weighted: null,
      unweighted: null,
      weightedCredits: 0,
      unweightedCredits: 0,
    });
  });

  it("maps thresholds to tones, including missing grades", () => {
    const thresholds = { a: 90, b: 80, c: 70, d: 60 };
    expect(gradeTone(90, thresholds)).toBe("a");
    expect(gradeTone(89.9, thresholds)).toBe("b");
    expect(gradeTone(70, thresholds)).toBe("c");
    expect(gradeTone(60, thresholds)).toBe("d");
    expect(gradeTone(59, thresholds)).toBe("f");
    expect(gradeTone(null, thresholds)).toBe("none");
  });
});
