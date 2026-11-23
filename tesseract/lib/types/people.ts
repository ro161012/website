import { z } from "zod";
import { HttpsUrlSchema, OpaqueIdSchema } from "./common";

export const ContactSchema = z.strictObject({
  name: z.string().min(1).max(120),
  email: z.email().nullable(),
  phone: z.string().min(1).max(40).nullable(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const TeacherSchema = z.strictObject({
  ...ContactSchema.shape,
  room: z.string().min(1).max(40).nullable(),
});
export type Teacher = z.infer<typeof TeacherSchema>;

export const StudentSchema = z.strictObject({
  id: OpaqueIdSchema,
  displayName: z.string().min(1).max(120),
  firstName: z.string().min(1).max(60).nullable(),
  lastName: z.string().min(1).max(60).nullable(),
  gradeLevel: z.string().min(1).max(20).nullable(),
  school: z.string().min(1).max(120).nullable(),
  homeroom: z.string().min(1).max(60).nullable(),
  counselor: ContactSchema.nullable(),
});
export type Student = z.infer<typeof StudentSchema>;

export const DistrictSchema = z.strictObject({
  /** App-scoped slug, not a HAC identifier. */
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  /** Normalized absolute base URL, no trailing slash. */
  baseUrl: HttpsUrlSchema,
  /** Key of the adapter profile used for this district. */
  profileId: z.string().min(1).max(64),
});
export type District = z.infer<typeof DistrictSchema>;
