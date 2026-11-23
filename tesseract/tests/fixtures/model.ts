import type { District, Student } from "@/lib/types";
import type { SessionInput } from "@/lib/session/schema";

export const TEST_STUDENT: Student = {
  id: "stu_test_jordan",
  displayName: "Jordan Ellis",
  firstName: "Jordan",
  lastName: "Ellis",
  gradeLevel: "11",
  school: "Ridgeline High School",
  homeroom: "B-204",
  counselor: null,
};

export const TEST_STUDENT_TWO: Student = {
  ...TEST_STUDENT,
  id: "stu_test_avery",
  displayName: "Avery Ellis",
  firstName: "Avery",
};

export const TEST_DISTRICT: District = {
  id: "dist_test_ridgeline",
  name: "Ridgeline Test District",
  baseUrl: "https://hac.example.edu",
  profileId: "hac-default",
};

export const TEST_SESSION_INPUT: SessionInput = {
  mode: "hac",
  district: TEST_DISTRICT,
  cookies: [],
  students: [TEST_STUDENT],
  activeStudentId: TEST_STUDENT.id,
};
