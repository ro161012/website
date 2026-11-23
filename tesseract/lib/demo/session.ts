import type { SessionInput } from "@/lib/session/schema";
import {
  DEMO_DISTRICT,
  DEMO_STUDENT,
} from "@/lib/providers/demo";

/** Build the payload for the encrypted demo session; no HAC cookies are stored. */
export function demoSessionInput(): SessionInput {
  return {
    mode: "demo",
    district: { ...DEMO_DISTRICT },
    cookies: [],
    students: [{ ...DEMO_STUDENT }],
    activeStudentId: DEMO_STUDENT.id,
  };
}
