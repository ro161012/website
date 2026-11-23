import { z } from "zod";
import { IsoDateTimeSchema, OpaqueIdSchema } from "./common";
import { GradeSchema } from "./academics";

export const AssignmentHashSchema = z.string().min(1).max(64);

export const SnapshotCourseSchema = z.strictObject({
  courseId: OpaqueIdSchema,
  courseName: z.string().min(1).max(160),
  grade: GradeSchema,
  assignmentHashes: z.record(OpaqueIdSchema, AssignmentHashSchema),
});
export type SnapshotCourse = z.infer<typeof SnapshotCourseSchema>;

export const SnapshotSchema = z.strictObject({
  id: OpaqueIdSchema,
  studentId: OpaqueIdSchema,
  markingPeriodId: OpaqueIdSchema.nullable(),
  capturedAt: IsoDateTimeSchema,
  courses: z.array(SnapshotCourseSchema),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;
