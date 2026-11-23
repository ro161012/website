import {
  AttendanceDaySchema,
  CourseSchema,
  ReportCardSchema,
  TranscriptSchema,
  type Assignment,
  type AssignmentWithCourse,
  type AttendanceDay,
  type AttendanceStatus,
  type Category,
  type Course,
  type CourseSummary,
  type MarkingPeriod,
  type MeData,
  type ReportCard,
  type Student,
  type Transcript,
  type Warning,
} from "@/lib/types";
import { NotFoundProblem } from "@/lib/security/errors";
import type { Session } from "@/lib/session/schema";
import { cached, providerCacheKey } from "./cache";
import type { DataProvider, ProviderResult } from "./types";

const TODAY = new Date("2026-11-21T12:00:00.000Z");
const MS_PER_DAY = 86_400_000;

export const DEMO_STUDENT: Student = {
  id: "stu_demo_jordan",
  displayName: "Jordan Ellis",
  firstName: "Jordan",
  lastName: "Ellis",
  gradeLevel: "11",
  school: "Ridgeline High School",
  homeroom: "B-204",
  counselor: {
    name: "Priya Raman",
    email: "p.raman@ridgeline.example",
    phone: "(555) 010-2210",
  },
};

export const DEMO_DISTRICT = {
  id: "dist_demo_ridgeline",
  name: "Ridgeline Demonstration District",
  baseUrl: "https://demo.tesseract.invalid",
  profileId: "demo",
} as const;

export const DEMO_MARKING_PERIODS: MarkingPeriod[] = [
  {
    id: "mp1",
    name: "Marking Period 1",
    shortName: "MP1",
    sequence: 0,
    startDate: "2026-08-18",
    endDate: "2026-10-23",
    isCurrent: false,
  },
  {
    id: "mp2",
    name: "Marking Period 2",
    shortName: "MP2",
    sequence: 1,
    startDate: "2026-10-26",
    endDate: "2027-01-15",
    isCurrent: true,
  },
  {
    id: "mp3",
    name: "Marking Period 3",
    shortName: "MP3",
    sequence: 2,
    startDate: "2027-01-19",
    endDate: "2027-05-28",
    isCurrent: false,
  },
];

interface CourseSeed {
  id: string;
  name: string;
  shortName: string;
  level: Course["level"];
  period: string;
  room: string;
  teacher: { name: string; email: string | null; phone: string | null; room: string | null };
  credits: number;
  categories: Array<{ name: string; weight: number }>;
  targets: Record<string, number | null>;
  assignmentNames: string[];
}

const DUE_DATES: Record<string, string[]> = {
  mp1: ["2026-09-02", "2026-09-23", "2026-10-14"],
  mp2: ["2026-11-04", "2026-11-12", "2026-11-24", "2026-12-03"],
  mp3: ["2027-02-10", "2027-03-10"],
};

const COURSE_SEEDS: CourseSeed[] = [
  {
    id: "course_ap_english",
    name: "AP English Language & Composition",
    shortName: "AP English",
    level: "ap",
    period: "1",
    room: "A-112",
    teacher: {
      name: "Elena Alvarez",
      email: "e.alvarez@ridgeline.example",
      phone: null,
      room: "A-112",
    },
    credits: 1,
    categories: [
      { name: "Major essays", weight: 50 },
      { name: "Reading checks", weight: 30 },
      { name: "Seminar", weight: 20 },
    ],
    targets: { mp1: 91, mp2: 94, mp3: null },
    assignmentNames: [
      "Rhetorical analysis: Kennedy",
      "Syntax and diction check",
      "Socratic seminar: justice",
      "Argument essay: public memory",
      "Rhetoric quiz: appeals",
      "Close reading: Baldwin",
      "Synthesis timed write",
      "Visual rhetoric analysis",
      "Seminar reflection",
    ],
  },
  {
    id: "course_precalc",
    name: "Honors Precalculus",
    shortName: "Precalculus",
    level: "honors",
    period: "2",
    room: "B-208",
    teacher: {
      name: "Samuel Okafor",
      email: "s.okafor@ridgeline.example",
      phone: null,
      room: "B-208",
    },
    credits: 1,
    categories: [
      { name: "Assessments", weight: 55 },
      { name: "Problem sets", weight: 30 },
      { name: "Warm-ups", weight: 15 },
    ],
    targets: { mp1: 88, mp2: 90, mp3: null },
    assignmentNames: [
      "Functions review quiz",
      "Polynomial problem set",
      "Warm-up portfolio",
      "Unit 3 test: trigonometry",
      "Identities problem set",
      "Warm-up: inverse trig",
      "Modeling project checkpoint",
      "Sequences quiz",
      "Warm-up: limits",
    ],
  },
  {
    id: "course_ap_biology",
    name: "AP Biology",
    shortName: "AP Biology",
    level: "ap",
    period: "3",
    room: "S-14",
    teacher: {
      name: "Mei Chen",
      email: "m.chen@ridgeline.example",
      phone: null,
      room: "S-14",
    },
    credits: 1,
    categories: [
      { name: "Unit tests", weight: 50 },
      { name: "Laboratories", weight: 35 },
      { name: "Practice", weight: 15 },
    ],
    targets: { mp1: 89, mp2: 92, mp3: null },
    assignmentNames: [
      "Cell transport lab",
      "Unit 2 test: cells",
      "Practice: water potential",
      "Enzyme kinetics lab",
      "Unit 3 test: metabolism",
      "Practice: photosynthesis",
      "Osmosis data analysis",
      "Cell cycle quiz",
      "Practice: meiosis",
    ],
  },
  {
    id: "course_us_history",
    name: "United States History",
    shortName: "U.S. History",
    level: "regular",
    period: "4",
    room: "C-106",
    teacher: {
      name: "Daniela Rivera",
      email: "d.rivera@ridgeline.example",
      phone: null,
      room: "C-106",
    },
    credits: 1,
    categories: [
      { name: "Assessments", weight: 45 },
      { name: "Document work", weight: 35 },
      { name: "Participation", weight: 20 },
    ],
    targets: { mp1: 87, mp2: 91, mp3: null },
    assignmentNames: [
      "Reconstruction document set",
      "Unit 1 assessment",
      "Seminar participation",
      "Industrialization DBQ",
      "Unit 2 assessment",
      "Primary source annotation",
      "Progressive Era debate",
      "Immigration document set",
      "Participation reflection",
    ],
  },
  {
    id: "course_spanish_three",
    name: "Spanish III Honors",
    shortName: "Spanish III",
    level: "honors",
    period: "5",
    room: "W-203",
    teacher: {
      name: "Lucía Morales",
      email: "l.morales@ridgeline.example",
      phone: null,
      room: "W-203",
    },
    credits: 1,
    categories: [
      { name: "Assessments", weight: 40 },
      { name: "Speaking", weight: 35 },
      { name: "Practice", weight: 25 },
    ],
    targets: { mp1: 93, mp2: 95, mp3: null },
    assignmentNames: [
      "Presentational speaking",
      "Vocabulary quiz",
      "Grammar practice",
      "Interpretive reading",
      "Conversation task",
      "Subjunctive practice",
      "Cultural comparison",
      "Listening assessment",
      "Speaking reflection",
    ],
  },
  {
    id: "course_cs_principles",
    name: "Computer Science Principles",
    shortName: "CS Principles",
    level: "regular",
    period: "6",
    room: "T-12",
    teacher: {
      name: "Hana Park",
      email: "h.park@ridgeline.example",
      phone: null,
      room: "T-12",
    },
    credits: 1,
    categories: [
      { name: "Projects", weight: 50 },
      { name: "Quizzes", weight: 30 },
      { name: "Classwork", weight: 20 },
    ],
    targets: { mp1: 90, mp2: 93, mp3: null },
    assignmentNames: [
      "Binary representation project",
      "Algorithms quiz",
      "Pair programming log",
      "Data visualization project",
      "Networks quiz",
      "Debugging challenge",
      "API design checkpoint",
      "Internet protocols quiz",
      "Classwork: recursion",
    ],
  },
  {
    id: "course_concert_band",
    name: "Concert Band",
    shortName: "Concert Band",
    level: "regular",
    period: "7",
    room: "M-1",
    teacher: {
      name: "Marcus Bell",
      email: "m.bell@ridgeline.example",
      phone: null,
      room: "M-1",
    },
    credits: 1,
    categories: [
      { name: "Performances", weight: 60 },
      { name: "Rehearsal", weight: 25 },
      { name: "Reflection", weight: 15 },
    ],
    targets: { mp1: 96, mp2: 97, mp3: null },
    assignmentNames: [
      "Fall concert performance",
      "Sectional rehearsal",
      "Program reflection",
      "Winter concert performance",
      "Chair placement",
      "Sight-reading check",
      "Improvisation workshop",
      "Ensemble rehearsal",
      "Listening journal",
    ],
  },
];

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  return new Date(value.getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

function letterFor(percent: number | null): string | null {
  if (percent === null) return null;
  if (percent >= 93) return "A";
  if (percent >= 90) return "A-";
  if (percent >= 87) return "B+";
  if (percent >= 83) return "B";
  if (percent >= 80) return "B-";
  if (percent >= 77) return "C+";
  if (percent >= 73) return "C";
  if (percent >= 70) return "C-";
  if (percent >= 67) return "D+";
  if (percent >= 60) return "D";
  return "F";
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildCourse(seed: CourseSeed, seedIndex: number, period: MarkingPeriod): Course {
  const assignments: Assignment[] = [];
  const categoryIds = seed.categories.map((_category, index) => `${seed.id}_cat_${index}`);
  const categoryAssignments = new Map<string, Assignment[]>();
  const categoryScores = new Map<string, { earned: number; possible: number }>();

  const range =
    period.id === "mp1"
      ? { start: 0, end: 2 }
      : period.id === "mp2"
        ? { start: 3, end: 6 }
        : { start: 7, end: 8 };

  seed.assignmentNames.forEach((name, index) => {
    if (index < range.start || index > range.end) return;

    const intoPeriod = index - range.start;
    const due = DUE_DATES[period.id]?.[intoPeriod];
    if (!due) return;

    const categoryIndex = index % seed.categories.length;
    const categoryId = categoryIds[categoryIndex] ?? `${seed.id}_cat_0`;

    const pointsPossible = categoryIndex === 0 ? 100 : categoryIndex === 1 ? 20 : 10;
    const target = seed.targets[period.id] ?? 0;
    const variation = ((index * 5 + seedIndex * 3) % 9) - 4;
    const percentTarget = clamp(target + variation, 55, 100);
    const isFuture = intoPeriod >= (period.id === "mp2" ? 2 : period.id === "mp3" ? 0 : 99);
    const isMissing = period.id === "mp1" && seedIndex === 2 && index === 2;
    const isExempt = period.id === "mp1" && seedIndex === 5 && index === 2;
    const isLate = period.id === "mp2" && seedIndex === 3 && index === 3;

    let score: number | null = Math.round((pointsPossible * percentTarget) / 100);
    let percent: number | null = roundOne((score / pointsPossible) * 100);
    let status: Assignment["status"] = "graded";

    if (isFuture) {
      score = null;
      percent = null;
      status = "not_graded";
    } else if (isMissing) {
      score = 0;
      percent = 0;
      status = "missing";
    } else if (isExempt) {
      score = null;
      percent = null;
      status = "exempt";
    } else if (isLate) {
      status = "late";
    }

    const assignment: Assignment = {
      id: `${seed.id}_${period.id}_asg_${index}`,
      courseId: seed.id,
      categoryId,
      name,
      dueDate: due,
      assignedDate: addDays(due, -7),
      score,
      pointsPossible,
      percent,
      status,
      isExtraCredit: index === 8,
      comment: isLate ? "Accepted one day late." : null,
      position: index,
    };

    assignments.push(assignment);
    const list = categoryAssignments.get(categoryId) ?? [];
    list.push(assignment);
    categoryAssignments.set(categoryId, list);

    if (status !== "exempt" && score !== null && pointsPossible > 0) {
      const scoreEntry = categoryScores.get(categoryId) ?? { earned: 0, possible: 0 };
      scoreEntry.earned += score;
      scoreEntry.possible += pointsPossible;
      categoryScores.set(categoryId, scoreEntry);
    }
  });

  const categories: Category[] = seed.categories.map((category, index) => {
    const categoryId = categoryIds[index] ?? `${seed.id}_cat_0`;
    const score = categoryScores.get(categoryId);
    return {
      id: categoryId,
      name: category.name,
      weightPercent: category.weight,
      pointsEarned: score ? roundOne(score.earned) : null,
      pointsPossible: score ? roundOne(score.possible) : null,
      averagePercent:
        score && score.possible > 0 ? roundOne((score.earned / score.possible) * 100) : null,
      position: index,
      assignmentIds: (categoryAssignments.get(categoryId) ?? []).map(
        (assignment) => assignment.id,
      ),
    };
  });

  const weighted = categories.filter(
    (category) =>
      category.averagePercent !== null && (category.weightPercent ?? 0) > 0,
  );
  const weightTotal = weighted.reduce(
    (sum, category) => sum + (category.weightPercent ?? 0),
    0,
  );
  const gradePercent =
    weightTotal > 0
      ? roundOne(
          weighted.reduce(
            (sum, category) =>
              sum + (category.averagePercent ?? 0) * (category.weightPercent ?? 0),
            0,
          ) / weightTotal,
        )
      : null;

  return CourseSchema.parse({
    id: seed.id,
    markingPeriodId: period.id,
    name: seed.name,
    shortName: seed.shortName,
    teacher: seed.teacher,
    period: seed.period,
    room: seed.room,
    level: seed.level,
    credits: seed.credits,
    grade: {
      percent: gradePercent,
      letter: letterFor(gradePercent),
    },
    classAverage: null,
    position: seedIndex,
    categories,
    assignments,
  });
}

const COURSES_BY_PERIOD: Record<string, Course[]> = Object.fromEntries(
  DEMO_MARKING_PERIODS.map((period) => [
    period.id,
    COURSE_SEEDS.map((seed, index) => buildCourse(seed, index, period)),
  ]),
);

const ALL_COURSES = Object.values(COURSES_BY_PERIOD).flat();

function summaryOf(course: Course): CourseSummary {
  return {
    id: course.id,
    markingPeriodId: course.markingPeriodId,
    name: course.name,
    shortName: course.shortName,
    teacher: course.teacher,
    period: course.period,
    room: course.room,
    level: course.level,
    credits: course.credits,
    grade: course.grade,
    classAverage: course.classAverage,
    position: course.position,
  };
}

function attendanceFor(): AttendanceDay[] {
  const days: AttendanceDay[] = [];
  const pattern: AttendanceStatus[] = [
    "present",
    "present",
    "present",
    "tardy",
    "present",
    "present",
    "absent",
    "present",
    "excused",
    "present",
    "remote",
    "present",
    "present",
    "present",
  ];
  const noSchool = new Set(["2026-11-03", "2026-11-11", "2026-11-26", "2026-11-27"]);
  const forcedAbsent = new Set(["2026-11-10"]);

  let cursor = new Date("2026-10-26T00:00:00Z");
  const end = new Date("2026-11-20T00:00:00Z");
  let index = 0;

  while (cursor <= end) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      const date = cursor.toISOString().slice(0, 10);
      const status = forcedAbsent.has(date)
        ? "absent"
        : noSchool.has(date)
          ? "no_school"
          : (pattern[index % pattern.length] ?? "present");
      const periods: AttendanceDay["periods"] =
        status === "absent"
          ? Array.from({ length: 7 }, (_value, periodIndex) => ({
              period: String(periodIndex + 1),
              status: "absent" as const,
              code: "A",
              reason: null,
            }))
          : status === "tardy"
            ? [
                {
                  period: "1",
                  status: "tardy" as const,
                  code: "T",
                  reason: "Bus delay",
                },
              ]
            : [];

      const candidate = {
        date,
        status,
        code:
          status === "present"
            ? "P"
            : status === "absent"
              ? "A"
              : status === "tardy"
                ? "T"
                : status === "excused"
                  ? "E"
                  : status === "remote"
                    ? "R"
                    : status === "no_school"
                      ? "NS"
                      : null,
        reason:
          status === "excused"
            ? "Medical appointment"
            : status === "absent"
              ? "Family emergency"
              : null,
        note: null,
        periods,
      };
      const parsed = AttendanceDaySchema.safeParse(candidate);
      if (parsed.success) days.push(parsed.data);
      index += 1;
    }
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }

  return days;
}

const ATTENDANCE = attendanceFor();

const REPORTS: ReportCard[] = [
  ReportCardSchema.parse({
    id: "report_mp1",
    kind: "report_card",
    title: "Marking Period 1 Report Card",
    markingPeriodId: "mp1",
    schoolYear: "2026–2027",
    issuedDate: "2026-10-28",
    entries: (COURSES_BY_PERIOD.mp1 ?? []).map((course) => ({
      courseId: course.id,
      courseName: course.name,
      teacherName: course.teacher?.name ?? null,
      grade: course.grade,
      credits: course.credits,
      comment: null,
    })),
    gpa: 3.82,
    absences: 2,
    tardies: 3,
  }),
  ReportCardSchema.parse({
    id: "report_mp2_progress",
    kind: "progress_report",
    title: "Marking Period 2 Progress Report",
    markingPeriodId: "mp2",
    schoolYear: "2026–2027",
    issuedDate: "2026-11-13",
    entries: (COURSES_BY_PERIOD.mp2 ?? []).map((course) => ({
      courseId: course.id,
      courseName: course.name,
      teacherName: course.teacher?.name ?? null,
      grade: course.grade,
      credits: course.credits,
      comment: null,
    })),
    gpa: 3.88,
    absences: 1,
    tardies: 1,
  }),
];

const TRANSCRIPT: Transcript = TranscriptSchema.parse({
  gpa: { weighted: 4.12, unweighted: 3.78 },
  rank: { position: 42, outOf: 486 },
  creditsEarned: 14.5,
  entries: [
    {
      courseName: "English 9 Honors",
      courseId: null,
      schoolYear: "2024–2025",
      term: "Full year",
      grade: { percent: 94, letter: "A" },
      credits: 1,
      level: "honors",
      includedInGpa: true,
    },
    {
      courseName: "Algebra I",
      courseId: null,
      schoolYear: "2024–2025",
      term: "Full year",
      grade: { percent: 91, letter: "A-" },
      credits: 1,
      level: "regular",
      includedInGpa: true,
    },
    {
      courseName: "Biology",
      courseId: null,
      schoolYear: "2024–2025",
      term: "Full year",
      grade: { percent: 93, letter: "A" },
      credits: 1,
      level: "regular",
      includedInGpa: true,
    },
    {
      courseName: "World History",
      courseId: null,
      schoolYear: "2024–2025",
      term: "Full year",
      grade: { percent: 90, letter: "A-" },
      credits: 1,
      level: "regular",
      includedInGpa: true,
    },
    {
      courseName: "Spanish II",
      courseId: null,
      schoolYear: "2024–2025",
      term: "Full year",
      grade: { percent: 95, letter: "A" },
      credits: 1,
      level: "regular",
      includedInGpa: true,
    },
    {
      courseName: "English 10 Honors",
      courseId: null,
      schoolYear: "2025–2026",
      term: "Full year",
      grade: { percent: 96, letter: "A" },
      credits: 1,
      level: "honors",
      includedInGpa: true,
    },
    {
      courseName: "Geometry Honors",
      courseId: null,
      schoolYear: "2025–2026",
      term: "Full year",
      grade: { percent: 92, letter: "A-" },
      credits: 1,
      level: "honors",
      includedInGpa: true,
    },
    {
      courseName: "Chemistry Honors",
      courseId: null,
      schoolYear: "2025–2026",
      term: "Full year",
      grade: { percent: 94, letter: "A" },
      credits: 1,
      level: "honors",
      includedInGpa: true,
    },
    {
      courseName: "AP Computer Science Principles",
      courseId: null,
      schoolYear: "2025–2026",
      term: "Full year",
      grade: { percent: 90, letter: "A-" },
      credits: 1,
      level: "ap",
      includedInGpa: true,
    },
  ],
});

function fetchedAt(): string {
  return new Date().toISOString();
}

function resolvePeriod(id?: string | null): MarkingPeriod {
  const period = id
    ? DEMO_MARKING_PERIODS.find((candidate) => candidate.id === id)
    : DEMO_MARKING_PERIODS.find((candidate) => candidate.isCurrent) ??
      DEMO_MARKING_PERIODS[0];
  if (!period) throw new NotFoundProblem("That marking period is not part of the demo.");
  return period;
}

export class DemoProvider implements DataProvider {
  readonly mode = "demo" as const;
  private readonly session: Session;

  constructor(session: Session) {
    this.session = session;
  }

  private load<T>(suffix: string, compute: () => T): Promise<ProviderResult<T>> {
    return cached(providerCacheKey(this.session, suffix), async () => ({
      data: compute(),
      warnings: [] as Warning[],
      fetchedAt: fetchedAt(),
    }));
  }

  getMe(): Promise<ProviderResult<MeData>> {
    return this.load("me", () => {
      const active = resolvePeriod(null);
      return {
        mode: this.mode,
        student:
          this.session.students.find(
            (student) => student.id === this.session.activeStudentId,
          ) ?? DEMO_STUDENT,
        students: this.session.students,
        district: this.session.district,
        markingPeriods: DEMO_MARKING_PERIODS,
        activeMarkingPeriodId: active.id,
      };
    });
  }

  getCourses(markingPeriodId?: string | null): Promise<ProviderResult<CourseSummary[]>> {
    return this.load(`courses:${markingPeriodId ?? "current"}`, () => {
      const period = resolvePeriod(markingPeriodId);
      return (COURSES_BY_PERIOD[period.id] ?? []).map(summaryOf);
    });
  }

  getCourse(
    courseId: string,
    markingPeriodId?: string | null,
  ): Promise<ProviderResult<Course>> {
    return this.load(`course:${markingPeriodId ?? "current"}:${courseId}`, () => {
      const period = resolvePeriod(markingPeriodId);
      const course = ALL_COURSES.find(
        (candidate) =>
          candidate.id === courseId && candidate.markingPeriodId === period.id,
      );
      if (!course) throw new NotFoundProblem("That course is not part of the demo.");
      return course;
    });
  }

  getUpcomingAssignments(days = 14): Promise<ProviderResult<AssignmentWithCourse[]>> {
    return this.load(`upcoming:${days}`, () => {
      const period = resolvePeriod(null);
      const end = new Date(TODAY.getTime() + days * MS_PER_DAY)
        .toISOString()
        .slice(0, 10);
      const start = TODAY.toISOString().slice(0, 10);
      const upcoming: AssignmentWithCourse[] = [];

      for (const course of COURSES_BY_PERIOD[period.id] ?? []) {
        for (const assignment of course.assignments) {
          if (!assignment.dueDate) continue;
          if (assignment.dueDate < start || assignment.dueDate > end) continue;
          if (assignment.status === "exempt") continue;
          upcoming.push({ ...assignment, courseName: course.name });
        }
      }

      return upcoming.sort(
        (a, b) =>
          (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
          a.courseName.localeCompare(b.courseName),
      );
    });
  }

  getAttendance(month?: string | null): Promise<ProviderResult<AttendanceDay[]>> {
    return this.load(`attendance:${month ?? "all"}`, () =>
      month ? ATTENDANCE.filter((day) => day.date.startsWith(`${month}-`)) : ATTENDANCE,
    );
  }

  getReports(): Promise<ProviderResult<ReportCard[]>> {
    return this.load("reports", () => REPORTS);
  }

  getTranscript(): Promise<ProviderResult<Transcript>> {
    return this.load("transcript", () => TRANSCRIPT);
  }

  switchStudent(studentId: string): Promise<ProviderResult<Student>> {
    return this.load(`switch:${studentId}`, () => {
      const student = this.session.students.find(
        (candidate) => candidate.id === studentId,
      );
      if (!student) throw new NotFoundProblem("That student is not part of this demo.");
      return student;
    });
  }
}

export const DEMO_COURSE_COUNT = 7;
export const DEMO_ASSIGNMENT_COUNT = ALL_COURSES.reduce(
  (count, course) => count + course.assignments.length,
  0,
);
