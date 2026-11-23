import type {
  AssignmentWithCourse,
  AttendanceDay,
  Course,
  CourseSummary,
  IsoDateTime,
  MeData,
  ReportCard,
  SessionMode,
  Student,
  Transcript,
  Warning,
} from "@/lib/types";
import type { StoredCookie } from "@/lib/session/schema";

export interface ProviderResult<T> {
  data: T;
  warnings: Warning[];
  fetchedAt: IsoDateTime;
  /** Refreshed HAC cookies to re-seal into the session, when present. */
  cookies?: StoredCookie[];
}

export interface DataProvider {
  readonly mode: SessionMode;
  getMe(): Promise<ProviderResult<MeData>>;
  getCourses(markingPeriodId?: string | null): Promise<ProviderResult<CourseSummary[]>>;
  getCourse(
    courseId: string,
    markingPeriodId?: string | null,
  ): Promise<ProviderResult<Course>>;
  getUpcomingAssignments(days?: number): Promise<ProviderResult<AssignmentWithCourse[]>>;
  getAttendance(month?: string | null): Promise<ProviderResult<AttendanceDay[]>>;
  getReports(): Promise<ProviderResult<ReportCard[]>>;
  getTranscript(): Promise<ProviderResult<Transcript>>;
  switchStudent?(studentId: string): Promise<ProviderResult<Student>>;
}
