import { z } from "zod";
import { IsoDateSchema, OpaqueIdSchema } from "./common";
import { TeacherSchema } from "./people";

export const GradeSchema = z.strictObject({
  percent: z.number().min(0).max(1000).nullable(),
  letter: z.string().trim().min(1).max(12).nullable(),
});
export type Grade = z.infer<typeof GradeSchema>;

export const COURSE_LEVELS = [
  "regular",
  "honors",
  "ap",
  "ib",
  "dual_enrollment",
  "other",
  "unknown",
] as const;
export const CourseLevelSchema = z.enum(COURSE_LEVELS);
export type CourseLevel = z.infer<typeof CourseLevelSchema>;

export const MarkingPeriodSchema = z.strictObject({
  id: OpaqueIdSchema,
  name: z.string().min(1).max(80),
  shortName: z.string().min(1).max(40).nullable(),
  sequence: z.number().int().min(0).max(99),
  startDate: IsoDateSchema.nullable(),
  endDate: IsoDateSchema.nullable(),
  isCurrent: z.boolean(),
});
export type MarkingPeriod = z.infer<typeof MarkingPeriodSchema>;

export const ASSIGNMENT_STATUSES = [
  "graded",
  "missing",
  "late",
  "exempt",
  "not_graded",
  "unknown",
] as const;
export const AssignmentStatusSchema = z.enum(ASSIGNMENT_STATUSES);
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;

export const AssignmentSchema = z.strictObject({
  id: OpaqueIdSchema,
  courseId: OpaqueIdSchema,
  categoryId: OpaqueIdSchema.nullable(),
  name: z.string().min(1).max(300),
  dueDate: IsoDateSchema.nullable(),
  assignedDate: IsoDateSchema.nullable(),
  score: z.number().min(0).max(1_000_000).nullable(),
  pointsPossible: z.number().min(0).max(1_000_000).nullable(),
  percent: z.number().min(0).max(1000).nullable(),
  status: AssignmentStatusSchema,
  isExtraCredit: z.boolean(),
  comment: z.string().max(2000).nullable(),
  position: z.number().int().min(0).max(100_000),
});
export type Assignment = z.infer<typeof AssignmentSchema>;

export const CategorySchema = z.strictObject({
  id: OpaqueIdSchema,
  name: z.string().min(1).max(120),
  weightPercent: z.number().min(0).max(1000).nullable(),
  pointsEarned: z.number().min(0).max(1_000_000).nullable(),
  pointsPossible: z.number().min(0).max(1_000_000).nullable(),
  averagePercent: z.number().min(0).max(1000).nullable(),
  position: z.number().int().min(0).max(10_000),
  assignmentIds: z.array(OpaqueIdSchema),
});
export type Category = z.infer<typeof CategorySchema>;

const courseSummaryShape = {
  id: OpaqueIdSchema,
  markingPeriodId: OpaqueIdSchema,
  name: z.string().min(1).max(160),
  shortName: z.string().min(1).max(80).nullable(),
  teacher: TeacherSchema.nullable(),
  period: z.string().min(1).max(40).nullable(),
  room: z.string().min(1).max(40).nullable(),
  level: CourseLevelSchema,
  credits: z.number().min(0).max(100).nullable(),
  grade: GradeSchema,
  classAverage: GradeSchema.nullable(),
  position: z.number().int().min(0).max(10_000),
};

export const CourseSummarySchema = z.strictObject(courseSummaryShape);
export type CourseSummary = z.infer<typeof CourseSummarySchema>;

export const CourseSchema = z
  .strictObject({
    ...courseSummaryShape,
    categories: z.array(CategorySchema),
    assignments: z.array(AssignmentSchema),
  })
  .superRefine((course, ctx) => {
    const categoryIds = new Set(course.categories.map((category) => category.id));

    for (const [index, assignment] of course.assignments.entries()) {
      if (assignment.courseId !== course.id) {
        ctx.addIssue({
          code: "custom",
          message: "Assignment does not belong to this course.",
          path: ["assignments", index, "courseId"],
        });
      }

      if (assignment.categoryId !== null && !categoryIds.has(assignment.categoryId)) {
        ctx.addIssue({
          code: "custom",
          message: "Assignment references an unknown category.",
          path: ["assignments", index, "categoryId"],
        });
      }
    }
  });
export type Course = z.infer<typeof CourseSchema>;

export const REPORT_KINDS = ["report_card", "progress_report"] as const;
export const ReportKindSchema = z.enum(REPORT_KINDS);
export type ReportKind = z.infer<typeof ReportKindSchema>;

export const ReportCardEntrySchema = z.strictObject({
  courseId: OpaqueIdSchema.nullable(),
  courseName: z.string().min(1).max(160),
  teacherName: z.string().min(1).max(120).nullable(),
  grade: GradeSchema,
  credits: z.number().min(0).max(100).nullable(),
  comment: z.string().max(2000).nullable(),
});
export type ReportCardEntry = z.infer<typeof ReportCardEntrySchema>;

export const ReportCardSchema = z.strictObject({
  id: OpaqueIdSchema,
  kind: ReportKindSchema,
  title: z.string().min(1).max(160),
  markingPeriodId: OpaqueIdSchema.nullable(),
  schoolYear: z.string().min(1).max(20).nullable(),
  issuedDate: IsoDateSchema.nullable(),
  entries: z.array(ReportCardEntrySchema),
  gpa: z.number().min(0).max(20).nullable(),
  absences: z.number().int().min(0).max(365).nullable(),
  tardies: z.number().int().min(0).max(365).nullable(),
});
export type ReportCard = z.infer<typeof ReportCardSchema>;

export const GpaSummarySchema = z.strictObject({
  weighted: z.number().min(0).max(20).nullable(),
  unweighted: z.number().min(0).max(20).nullable(),
});
export type GpaSummary = z.infer<typeof GpaSummarySchema>;

export const ClassRankSchema = z
  .strictObject({
    position: z.number().int().positive(),
    outOf: z.number().int().positive(),
  })
  .refine((rank) => rank.position <= rank.outOf, {
    message: "Rank position cannot exceed the class size.",
    path: ["position"],
  });
export type ClassRank = z.infer<typeof ClassRankSchema>;

export const TranscriptEntrySchema = z.strictObject({
  courseName: z.string().min(1).max(160),
  courseId: OpaqueIdSchema.nullable(),
  schoolYear: z.string().min(1).max(20),
  term: z.string().min(1).max(40).nullable(),
  grade: GradeSchema,
  credits: z.number().min(0).max(100).nullable(),
  level: CourseLevelSchema,
  includedInGpa: z.boolean(),
});
export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;

export const TranscriptSchema = z.strictObject({
  gpa: GpaSummarySchema,
  rank: ClassRankSchema.nullable(),
  creditsEarned: z.number().min(0).max(1000).nullable(),
  entries: z.array(TranscriptEntrySchema),
});
export type Transcript = z.infer<typeof TranscriptSchema>;
