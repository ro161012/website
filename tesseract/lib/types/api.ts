import { z } from "zod";
import { apiSuccessSchema, HttpsUrlSchema, OpaqueIdSchema } from "./common";
import { AttendanceDaySchema, AttendanceMonthSchema } from "./attendance";
import {
  AssignmentSchema,
  CourseSchema,
  CourseSummarySchema,
  MarkingPeriodSchema,
  ReportCardSchema,
  TranscriptSchema,
} from "./academics";
import { DistrictSchema, StudentSchema } from "./people";

export const LoginRequestSchema = z.strictObject({
  username: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(500),
  campusId: z.string().trim().min(1).max(128).optional(),
  /** Optional per-sign-in district; the deployment's HAC_DISTRICT_URL is the fallback. */
  districtUrl: HttpsUrlSchema.optional(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("authenticated"),
    student: StudentSchema,
    students: z.array(StudentSchema).min(1),
    district: DistrictSchema,
  }),
  z.strictObject({
    status: z.literal("mfa_required"),
  }),
]);
export type LoginResult = z.infer<typeof LoginResultSchema>;

export const SelectStudentRequestSchema = z.strictObject({
  studentId: OpaqueIdSchema,
});
export type SelectStudentRequest = z.infer<typeof SelectStudentRequestSchema>;

export const SESSION_MODES = ["hac", "demo"] as const;
export const SessionModeSchema = z.enum(SESSION_MODES);
export type SessionMode = z.infer<typeof SessionModeSchema>;

export const MeDataSchema = z.strictObject({
  mode: SessionModeSchema,
  student: StudentSchema,
  students: z.array(StudentSchema).min(1),
  district: DistrictSchema,
  markingPeriods: z.array(MarkingPeriodSchema),
  activeMarkingPeriodId: OpaqueIdSchema.nullable(),
});
export type MeData = z.infer<typeof MeDataSchema>;

export const CoursesQuerySchema = z.strictObject({
  mp: OpaqueIdSchema.optional(),
});
export type CoursesQuery = z.infer<typeof CoursesQuerySchema>;

export const AttendanceQuerySchema = z.strictObject({
  month: AttendanceMonthSchema.optional(),
});
export type AttendanceQuery = z.infer<typeof AttendanceQuerySchema>;

export const AssignmentWithCourseSchema = z.strictObject({
  ...AssignmentSchema.shape,
  courseName: z.string().min(1).max(160),
});
export type AssignmentWithCourse = z.infer<typeof AssignmentWithCourseSchema>;

export const LoginResponseSchema = apiSuccessSchema(LoginResultSchema);
export const LogoutResponseSchema = apiSuccessSchema(
  z.strictObject({ ok: z.literal(true) }),
);
export const MeResponseSchema = apiSuccessSchema(MeDataSchema);
export const StudentsResponseSchema = apiSuccessSchema(z.array(StudentSchema));
export const CoursesResponseSchema = apiSuccessSchema(z.array(CourseSummarySchema));
export const CourseResponseSchema = apiSuccessSchema(CourseSchema);
export const UpcomingAssignmentsResponseSchema = apiSuccessSchema(
  z.array(AssignmentWithCourseSchema),
);
export const AttendanceResponseSchema = apiSuccessSchema(z.array(AttendanceDaySchema));
export const ReportsResponseSchema = apiSuccessSchema(z.array(ReportCardSchema));
export const TranscriptResponseSchema = apiSuccessSchema(TranscriptSchema);
