import { z } from "zod";
import { IsoDateSchema } from "./common";

export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "tardy",
  "excused",
  "remote",
  "no_school",
  "unknown",
] as const;
export const AttendanceStatusSchema = z.enum(ATTENDANCE_STATUSES);
export type AttendanceStatus = z.infer<typeof AttendanceStatusSchema>;

export const AttendancePeriodSchema = z.strictObject({
  period: z.string().min(1).max(40),
  status: AttendanceStatusSchema,
  code: z.string().min(1).max(40).nullable(),
  reason: z.string().min(1).max(240).nullable(),
});
export type AttendancePeriod = z.infer<typeof AttendancePeriodSchema>;

export const AttendanceDaySchema = z.strictObject({
  date: IsoDateSchema,
  status: AttendanceStatusSchema,
  code: z.string().min(1).max(40).nullable(),
  reason: z.string().min(1).max(240).nullable(),
  note: z.string().max(1000).nullable(),
  periods: z.array(AttendancePeriodSchema),
});
export type AttendanceDay = z.infer<typeof AttendanceDaySchema>;

export const AttendanceMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month in YYYY-MM form.");
export type AttendanceMonth = z.infer<typeof AttendanceMonthSchema>;
