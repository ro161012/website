import { z } from "zod";
import {
  DistrictSchema,
  OpaqueIdSchema,
  SessionModeSchema,
  StudentSchema,
} from "@/lib/types";

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const SESSION_MAX_JSON_BYTES = 2_800;

export const StoredCookieSchema = z.strictObject({
  name: z.string().min(1).max(128),
  value: z.string().max(3_500),
  domain: z.string().min(1).max(255),
  path: z.string().min(1).max(255),
  secure: z.boolean(),
  httpOnly: z.boolean(),
  expiresAt: z.number().int().positive().nullable(),
});
export type StoredCookie = z.infer<typeof StoredCookieSchema>;

export const SessionSchema = z
  .strictObject({
    v: z.literal(1),
    mode: SessionModeSchema,
    district: DistrictSchema,
    cookies: z.array(StoredCookieSchema).max(40),
    students: z.array(StudentSchema).min(1).max(10),
    activeStudentId: OpaqueIdSchema,
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
  })
  .superRefine((session, ctx) => {
    if (!session.students.some((student) => student.id === session.activeStudentId)) {
      ctx.addIssue({
        code: "custom",
        message: "The active student is not in the student list.",
        path: ["activeStudentId"],
      });
    }

    if (new Set(session.students.map((student) => student.id)).size !== session.students.length) {
      ctx.addIssue({
        code: "custom",
        message: "Student ids must be unique.",
        path: ["students"],
      });
    }

    if (session.expiresAt <= session.issuedAt) {
      ctx.addIssue({
        code: "custom",
        message: "The session expiry must follow its issue time.",
        path: ["expiresAt"],
      });
    }

    if (session.expiresAt - session.issuedAt > SESSION_TTL_MS + 60_000) {
      ctx.addIssue({
        code: "custom",
        message: "A session cannot live longer than twelve hours.",
        path: ["expiresAt"],
      });
    }
  });

export type Session = z.infer<typeof SessionSchema>;
export type SessionInput = Omit<Session, "v" | "issuedAt" | "expiresAt">;
