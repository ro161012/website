"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { LogoMark } from "@/components/brand/logo-mark";
import { SITE } from "@/lib/config/site";
import type {
  AssignmentStatus,
  AssignmentWithCourse,
  AttendanceDay,
  AttendanceStatus,
  CourseSummary,
  MeData,
  ReportCard,
  Transcript,
  Warning,
} from "@/lib/types";
import { apiGet, errorMessage, SessionLostError } from "./api";
import type { ApiEnvelope } from "./api";
import { CoursePanel } from "./course-panel";
import {
  currentMonthKey,
  formatLongDate,
  formatMonth,
  formatPercent,
  formatPoints,
  formatShortDate,
  formatWeekday,
  initials,
  relativeDue,
  shiftMonth,
} from "./format";
import styles from "@/app/dashboard/dashboard.module.css";

type Tab =
  | "courses"
  | "upcoming"
  | "attendance"
  | "reports"
  | "transcript";

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "courses", label: "Courses" },
  { id: "upcoming", label: "Upcoming" },
  { id: "attendance", label: "Attendance" },
  { id: "reports", label: "Reports" },
  { id: "transcript", label: "Transcript" },
];

const LEVEL_LABELS: Record<CourseSummary["level"], string> = {
  regular: "Regular",
  honors: "Honors",
  ap: "AP",
  ib: "IB",
  dual_enrollment: "Dual enrollment",
  other: "Other",
  unknown: "Course",
};

const ASSIGNMENT_LABELS: Record<AssignmentStatus, string> = {
  graded: "Graded",
  missing: "Missing",
  late: "Late",
  exempt: "Exempt",
  not_graded: "Not graded",
  unknown: "Unknown",
};

const ASSIGNMENT_STATUS_CLASS: Record<AssignmentStatus, string | undefined> = {
  graded: styles.statusGraded,
  missing: styles.statusMissing,
  late: styles.statusLate,
  exempt: styles.statusExempt,
  not_graded: styles.statusNotGraded,
  unknown: styles.statusUnknown,
};

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  tardy: "Tardy",
  excused: "Excused",
  remote: "Remote",
  no_school: "No school",
  unknown: "Unknown",
};

const ATTENDANCE_STATUS_CLASS: Record<AttendanceStatus, string | undefined> = {
  present: styles.attendancePresent,
  absent: styles.attendanceAbsent,
  tardy: styles.attendanceTardy,
  excused: styles.attendanceExcused,
  remote: styles.attendanceRemote,
  no_school: styles.attendanceNoSchool,
  unknown: styles.attendanceUnknown,
};

type ResourceState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

function CourseCard({
  course,
  onOpen,
}: {
  course: CourseSummary;
  onOpen: (course: CourseSummary) => void;
}) {
  const code = /^\s*([A-Z0-9]+)\s*-\s*\d+\b/i.exec(course.name)?.[1] ?? null;
  const title = course.name.replace(/^\s*[A-Z0-9]+\s*-\s*\d+\s*/i, "");
  const details = [
    course.teacher?.name ?? null,
    course.room ? `Room ${course.room}` : null,
  ].filter(Boolean);

  return (
    <button
      className={styles.courseCard}
      onClick={() => onOpen(course)}
      title={course.name}
      type="button"
    >
      <span className={styles.courseCardTop}>
        <span className={styles.courseTag}>
          {code ?? LEVEL_LABELS[course.level]}
        </span>
        {course.period ? (
          <span className={styles.coursePeriod}>Period {course.period}</span>
        ) : null}
      </span>
      <span className={styles.courseName}>{title}</span>
      {details.length > 0 ? (
        <span className={styles.courseTeacher}>{details.join(" · ")}</span>
      ) : null}
      <span className={styles.courseFoot}>
        <span className={styles.gradePercent}>
          {formatPoints(course.grade.percent)}
          {course.grade.percent !== null ? (
            <span className={styles.gradeUnit}>%</span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function StatusChip({ status }: { status: AssignmentStatus }) {
  return (
    <span
      className={`${styles.statusChip} ${ASSIGNMENT_STATUS_CLASS[status]}`}
    >
      {ASSIGNMENT_LABELS[status]}
    </span>
  );
}

function UpcomingRow({
  assignment,
  onOpenCourse,
}: {
  assignment: AssignmentWithCourse;
  onOpenCourse: (courseId: string) => void;
}) {
  return (
    <li className={styles.upcomingItem}>
      <span className={styles.dateBlock}>
        <span className={styles.dateDay}>
          {assignment.dueDate ? formatShortDate(assignment.dueDate).split(" ")[1] : "—"}
        </span>
        <span className={styles.dateMonth}>
          {assignment.dueDate ? formatShortDate(assignment.dueDate).split(" ")[0] : "Date"}
        </span>
      </span>

      <button
        className={styles.upcomingBody}
        onClick={() => onOpenCourse(assignment.courseId)}
        type="button"
      >
        <span className={styles.upcomingName}>{assignment.name}</span>
        <span className={styles.upcomingMeta}>{assignment.courseName}</span>
      </button>

      <span className={styles.upcomingSide}>
        <StatusChip status={assignment.status} />
        <span className={styles.upcomingWhen}>
          {relativeDue(assignment.dueDate)}
        </span>
      </span>
    </li>
  );
}

function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyTitle}>{title}</span>
      <span>{body}</span>
    </div>
  );
}

function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className={styles.skeletonGrid}>
      {Array.from({ length: rows }, (_, index) => (
        <span className={styles.skeleton} key={index} />
      ))}
    </div>
  );
}

interface WorkspaceSnapshot {
  me: MeData;
  courses: CourseSummary[];
  upcoming: AssignmentWithCourse[];
  warnings: Warning[];
}

async function fetchWorkspace(): Promise<WorkspaceSnapshot> {
  const meResult = await apiGet<MeData>("/api/me");
  const period = meResult.data.activeMarkingPeriodId;

  const [courseResult, upcomingResult] = await Promise.all([
    apiGet<CourseSummary[]>(
      `/api/courses${period ? `?mp=${encodeURIComponent(period)}` : ""}`,
    ),
    apiGet<AssignmentWithCourse[]>("/api/assignments/upcoming?days=21"),
  ]);

  return {
    me: meResult.data,
    courses: courseResult.data,
    upcoming: upcomingResult.data,
    warnings: [
      ...meResult.warnings,
      ...courseResult.warnings,
      ...upcomingResult.warnings,
    ],
  };
}

export function Workspace() {
  const router = useRouter();
  const [me, setMe] = useState<MeData | null>(null);
  const [booted, setBooted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [tab, setTab] = useState<Tab>("courses");
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [upcoming, setUpcoming] = useState<AssignmentWithCourse[] | null>(null);
  const [attendance, setAttendance] = useState<AttendanceDay[] | null>(null);
  const [month, setMonth] = useState(currentMonthKey);
  const [markingPeriod, setMarkingPeriod] = useState<string | null>(null);
  const [reports, setReports] = useState<ResourceState<ReportCard[]>>({
    status: "idle",
  });
  const [transcript, setTranscript] = useState<ResourceState<Transcript>>({
    status: "idle",
  });
  const [selectedCourse, setSelectedCourse] = useState<CourseSummary | null>(
    null,
  );
  const [refreshToken, setRefreshToken] = useState(0);

  const periodSequence = useRef(0);

  const mergeWarnings = useCallback((incoming: Warning[]) => {
    if (incoming.length === 0) return;
    setWarnings((previous) => {
      const key = (warning: Warning): string =>
        `${warning.code}|${warning.message}|${warning.path ?? ""}`;
      const seen = new Set(previous.map(key));
      const next = incoming.filter((warning) => !seen.has(key(warning)));
      return next.length > 0 ? [...previous, ...next] : previous;
    });
  }, []);

  const handleFailure = useCallback(
    (problem: unknown): void => {
      if (problem instanceof SessionLostError) {
        router.replace("/?expired=1");
        router.refresh();
        return;
      }
      setError(errorMessage(problem));
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;

    fetchWorkspace()
      .then((snapshot) => {
        if (cancelled) return;
        setMe(snapshot.me);
        setMarkingPeriod(snapshot.me.activeMarkingPeriodId);
        setCourses(snapshot.courses);
        setUpcoming(snapshot.upcoming);
        mergeWarnings(snapshot.warnings);
      })
      .catch((problem: unknown) => {
        if (cancelled) return;
        handleFailure(problem);
      })
      .finally(() => {
        if (!cancelled) {
          setBooted(true);
          setRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshToken, handleFailure, mergeWarnings]);

  useEffect(() => {
    if (tab !== "attendance" || attendance !== null) return;

    let cancelled = false;
    apiGet<AttendanceDay[]>("/api/attendance")
      .then((result) => {
        if (cancelled) return;
        setAttendance(result.data);
        mergeWarnings(result.warnings);
      })
      .catch((problem: unknown) => {
        if (cancelled) return;
        if (problem instanceof SessionLostError) {
          handleFailure(problem);
          return;
        }
        setAttendance([]);
        handleFailure(problem);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, attendance, handleFailure, mergeWarnings]);

  useEffect(() => {
    if (tab !== "reports" || reports.status !== "idle") return;

    let cancelled = false;
    apiGet<ReportCard[]>("/api/reports")
      .then((result) => {
        if (cancelled) return;
        setReports({ status: "ready", data: result.data });
        mergeWarnings(result.warnings);
      })
      .catch((problem: unknown) => {
        if (cancelled) return;
        if (problem instanceof SessionLostError) {
          handleFailure(problem);
          return;
        }
        setReports({ status: "error", message: errorMessage(problem) });
      });

    return () => {
      cancelled = true;
    };
  }, [tab, reports.status, handleFailure, mergeWarnings]);

  useEffect(() => {
    if (tab !== "transcript" || transcript.status !== "idle") return;

    let cancelled = false;
    apiGet<Transcript>("/api/transcript")
      .then((result) => {
        if (cancelled) return;
        setTranscript({ status: "ready", data: result.data });
        mergeWarnings(result.warnings);
      })
      .catch((problem: unknown) => {
        if (cancelled) return;
        if (problem instanceof SessionLostError) {
          handleFailure(problem);
          return;
        }
        setTranscript({ status: "error", message: errorMessage(problem) });
      });

    return () => {
      cancelled = true;
    };
  }, [tab, transcript.status, handleFailure, mergeWarnings]);

  const choosePeriod = async (next: string) => {
    if (!next || next === markingPeriod) return;

    const sequence = ++periodSequence.current;
    setMarkingPeriod(next);
    setCourses(null);
    setSelectedCourse(null);
    setRefreshing(true);
    setError(null);

    try {
      const result = await apiGet<CourseSummary[]>(
        `/api/courses?mp=${encodeURIComponent(next)}`,
      );
      if (sequence !== periodSequence.current) return;
      setCourses(result.data);
      // Course warnings belong to the selected marking period; replace the
      // previous period's warnings instead of leaving a stale banner behind.
      setWarnings(result.warnings);
    } catch (problem) {
      if (sequence !== periodSequence.current) return;
      handleFailure(problem);
      setCourses([]);
    } finally {
      if (sequence === periodSequence.current) setRefreshing(false);
    }
  };

  const chooseMonth = (next: string) => {
    setMonth(next);
  };

  const switchStudent = async (studentId: string) => {
    if (!me || studentId === me.student.id || switching) return;

    setSwitching(true);
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch("/api/students/active", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentId }),
      });

      const body = (await response
        .json()
        .catch(() => null)) as ApiEnvelope<unknown> | null;

      if (
        response.status === 401 ||
        body?.error?.code === "unauthorized" ||
        body?.error?.code === "session_expired"
      ) {
        handleFailure(new SessionLostError());
        return;
      }

      if (!response.ok || body?.data === undefined) {
        setError(
          body?.error?.message ?? "Tesseract could not switch students.",
        );
        return;
      }

      setSelectedCourse(null);
      setAttendance(null);
      setReports({ status: "idle" });
      setTranscript({ status: "idle" });
      setTab("courses");
      setRefreshToken((value) => value + 1);
    } catch {
      setError("Tesseract could not switch students. Check your connection.");
    } finally {
      setSwitching(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      // The cookie is HttpOnly; a failed request should still return to the form.
    }
    router.replace("/");
    router.refresh();
  };

  const closeCourse = useCallback(() => setSelectedCourse(null), []);

  const openCourseById = (courseId: string) => {
    const course = courses?.find((candidate) => candidate.id === courseId);
    if (course) setSelectedCourse(course);
  };

  if (!me && !booted) {
    return (
      <main className={styles.loadingWrap}>
        <div aria-live="polite" className={styles.loadingCard}>
          <LogoMark className={styles.loadingMark} size={54} title="Tesseract" />
          <h1 className={styles.loadingTitle}>Opening your record</h1>
          <p className={styles.loadingCopy}>
            Reading the current marking period from your district&apos;s Home
            Access Center.
          </p>
          <span aria-hidden="true" className={styles.loaderLine} />
        </div>
      </main>
    );
  }

  if (!me) {
    return (
      <main className={styles.loadingWrap}>
        <div className={styles.errorCard} role="alert">
          <LogoMark size={46} title="Tesseract" />
          <h1 className={styles.errorTitle}>We couldn&apos;t open your record.</h1>
          <p className={styles.errorCopy}>
            {error ?? "The session could not be read. Sign in again to continue."}
          </p>
          <div className={styles.errorActions}>
            <button
              className={styles.primaryAction}
              onClick={() => {
                setError(null);
                setBooted(false);
                setRefreshToken((value) => value + 1);
              }}
              type="button"
            >
              Try again
            </button>
            <button
              className={styles.secondaryAction}
              onClick={() => void signOut()}
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  const currentTabLabel = TABS.find((item) => item.id === tab)?.label ?? "Courses";
  const monthAttendance = attendance?.filter((day) =>
    day.date.startsWith(`${month}-`),
  ) ?? null;
  const transcriptEntries =
    transcript.status === "ready" ? transcript.data.entries : [];
  const transcriptHasTerm = transcriptEntries.some(
    (entry) => entry.term !== null,
  );
  const transcriptHasCredits = transcriptEntries.some(
    (entry) => entry.credits !== null && entry.credits > 0,
  );

  return (
    <>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>

      <div className={styles.appFrame}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTop}>
            <div className={styles.brandRow}>
              <LogoMark size={36} title="Tesseract" />
              <span className={styles.wordmark}>{SITE.wordmark}</span>
            </div>

            <div className={styles.studentCard}>
              <span aria-hidden="true" className={styles.avatar}>
                {initials(me.student.displayName)}
              </span>
              <span className={styles.studentText}>
                <span className={styles.studentName}>
                  {me.student.displayName}
                </span>
                <span className={styles.studentMeta}>
                  {[
                    me.student.gradeLevel
                      ? `Grade ${me.student.gradeLevel}`
                      : null,
                    me.student.school,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </div>

            {me.students.length > 1 ? (
              <label className={styles.studentSwitch}>
                <span>Viewing student</span>
                <select
                  disabled={switching}
                  onChange={(event) => void switchStudent(event.target.value)}
                  value={me.student.id}
                >
                  {me.students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <nav aria-label="Workspace" className={styles.nav}>
              {TABS.map((item, index) => (
                <button
                  aria-current={tab === item.id ? "page" : undefined}
                  className={
                    tab === item.id
                      ? `${styles.navItem} ${styles.navActive}`
                      : styles.navItem
                  }
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  type="button"
                >
                  <span aria-hidden="true" className={styles.navIndex}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className={styles.sidebarFoot}>
            <button
              className={styles.signOut}
              disabled={signingOut}
              onClick={() => void signOut()}
              type="button"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </aside>

        <div className={styles.main}>
          <header className={styles.topbar}>
            <div className={styles.topbarTitleWrap}>
              <h1 className={styles.topbarTitle}>{currentTabLabel}</h1>
            </div>

            <div className={styles.topbarActions}>
              <label className={styles.periodControl}>
                <span>Marking period</span>
                <select
                  disabled={refreshing || me.markingPeriods.length === 0}
                  onChange={(event) => void choosePeriod(event.target.value)}
                  value={markingPeriod ?? ""}
                >
                  {markingPeriod === null ? (
                    <option value="" disabled>
                      Choose a period
                    </option>
                  ) : null}
                  {me.markingPeriods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.shortName ?? period.name}
                      {period.isCurrent ? " · current" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <span className={styles.syncBadge}>
                <span
                  aria-hidden="true"
                  className={
                    refreshing
                      ? `${styles.syncDot} ${styles.syncDotBusy}`
                      : styles.syncDot
                  }
                />
                {refreshing ? "Syncing" : "Up to date"}
              </span>
            </div>
          </header>

          <main className={styles.content} id="main">
            {warnings.length > 0 ? (
              <details className={styles.warningsBar}>
                <summary className={styles.warningSummary}>
                  Some HAC pages came back incomplete
                  <span aria-hidden="true"> · Review</span>
                </summary>
                <ul className={styles.warningList}>
                  {warnings.map((warning) => (
                    <li key={`${warning.code}|${warning.message}`}>
                      {warning.message}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {error ? (
              <div className={styles.inlineError} role="alert">
                <span>{error}</span>
                <button
                  className={styles.inlineRetry}
                  onClick={() => {
                    setError(null);
                    setAttendance(null);
                    setRefreshing(true);
                    setRefreshToken((value) => value + 1);
                  }}
                  type="button"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {tab === "courses" ? (
              <>
                {courses === null ? (
                  <LoadingSkeleton rows={6} />
                ) : courses.length === 0 ? (
                  <EmptyState
                    body="HAC returned no courses for this marking period."
                    title="No courses here"
                  />
                ) : (
                  <div className={`${styles.courseGrid} ${styles.courseGridFull}`}>
                    {courses.map((course) => (
                      <CourseCard
                        course={course}
                        key={course.id}
                        onOpen={setSelectedCourse}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : null}

            {tab === "upcoming" ? (
              <>
                {upcoming === null ? (
                  <LoadingSkeleton rows={5} />
                ) : upcoming.length === 0 ? (
                  <EmptyState
                    body="No assignments are due in this window."
                    title="A clear stretch"
                  />
                ) : (
                  <section className={styles.panel}>
                    <ol className={styles.upcomingList}>
                      {upcoming.map((assignment) => (
                        <UpcomingRow
                          assignment={assignment}
                          key={assignment.id}
                          onOpenCourse={openCourseById}
                        />
                      ))}
                    </ol>
                  </section>
                )}
              </>
            ) : null}

            {tab === "attendance" ? (
              <>
                <div className={styles.monthBar}>
                  <button
                    aria-label="Previous month"
                    className={styles.monthButton}
                    onClick={() => chooseMonth(shiftMonth(month, -1))}
                    type="button"
                  >
                    ←
                  </button>
                  <span className={styles.monthLabel}>{formatMonth(month)}</span>
                  <button
                    aria-label="Next month"
                    className={styles.monthButton}
                    onClick={() => chooseMonth(shiftMonth(month, 1))}
                    type="button"
                  >
                    →
                  </button>
                </div>

                {monthAttendance === null ? (
                  <LoadingSkeleton rows={4} />
                ) : monthAttendance.length === 0 ? (
                  <EmptyState
                    body="HAC has no attendance records for this month."
                    title="Nothing recorded"
                  />
                ) : (
                  <section className={styles.panel}>
                    <ul className={styles.attendanceList}>
                      {monthAttendance.map((day) => (
                        <li className={styles.attendanceRow} key={day.date}>
                          <span className={styles.attendanceDate}>
                            <span className={styles.attendanceDateDay}>
                              {formatShortDate(day.date).split(" ")[1]}
                            </span>
                            <span className={styles.attendanceDateWeekday}>
                              {formatWeekday(day.date)}
                            </span>
                          </span>

                          <span className={styles.attendanceMain}>
                            <span
                              className={`${styles.statusChip} ${ATTENDANCE_STATUS_CLASS[day.status]}`}
                            >
                              {ATTENDANCE_LABELS[day.status]}
                            </span>
                            {day.reason || day.note ? (
                              <span className={styles.attendanceReason}>
                                {day.reason ?? day.note}
                              </span>
                            ) : null}
                          </span>

                          <span className={styles.attendancePeriods}>
                            {day.periods.length > 0
                              ? `${day.periods.length} period note${
                                  day.periods.length === 1 ? "" : "s"
                                }`
                              : formatLongDate(day.date).split(",")[0]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            ) : null}

            {tab === "reports" ? (
              <>
                {reports.status === "idle" || reports.status === "loading" ? (
                  <LoadingSkeleton rows={2} />
                ) : reports.status === "error" ? (
                  <div className={styles.emptyState} role="alert">
                    <span className={styles.emptyTitle}>Reports unavailable</span>
                    <span>{reports.message}</span>
                    <button
                      className={styles.panelAction}
                      onClick={() => setReports({ status: "idle" })}
                      type="button"
                    >
                      Try again
                    </button>
                  </div>
                ) : reports.data.length === 0 ? (
                  <EmptyState
                    body="No report cards or progress reports came back from HAC."
                    title="Nothing issued yet"
                  />
                ) : (
                  <div className={styles.reportGrid}>
                    {reports.data.map((report) => {
                      const stats = [
                        { label: "GPA", value: report.gpa },
                        { label: "Absences", value: report.absences },
                        { label: "Tardies", value: report.tardies },
                      ].filter(
                        (stat): stat is { label: string; value: number } =>
                          stat.value !== null,
                      );
                      const hasTeachers = report.entries.some(
                        (entry) => entry.teacherName !== null,
                      );
                      const hasCredits = report.entries.some(
                        (entry) => entry.credits !== null && entry.credits > 0,
                      );

                      return (
                        <article className={styles.panel} key={report.id}>
                          <div className={styles.reportHead}>
                            <span className={styles.reportKind}>
                              {report.kind === "report_card"
                                ? "Report card"
                                : "Progress report"}
                            </span>
                            {report.issuedDate ? (
                              <span className={styles.reportIssued}>
                                {formatLongDate(report.issuedDate)}
                              </span>
                            ) : null}
                          </div>

                          <h2 className={styles.reportTitle}>{report.title}</h2>
                          <p className={styles.reportMeta}>
                            {[
                              report.schoolYear,
                              report.entries.length > 0
                                ? `${report.entries.length} courses`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "School record"}
                          </p>

                          {stats.length > 0 ? (
                            <div className={styles.reportStats}>
                              {stats.map((stat) => (
                                <div className={styles.reportStat} key={stat.label}>
                                  <span className={styles.reportStatValue}>
                                    {stat.value}
                                  </span>
                                  <span className={styles.reportStatLabel}>
                                    {stat.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <div className={styles.tableWrap}>
                            <table className={styles.dataTable}>
                              <thead>
                                <tr>
                                  <th scope="col">Course</th>
                                  {hasTeachers ? <th scope="col">Teacher</th> : null}
                                  <th className={styles.num} scope="col">
                                    Grade
                                  </th>
                                  {hasCredits ? (
                                    <th className={styles.num} scope="col">
                                      Credits
                                    </th>
                                  ) : null}
                                </tr>
                              </thead>
                              <tbody>
                                {report.entries.map((entry, index) => (
                                  <tr
                                    key={`${report.id}-${entry.courseId ?? entry.courseName}-${index}`}
                                  >
                                    <td>{entry.courseName}</td>
                                    {hasTeachers ? (
                                      <td>{entry.teacherName ?? "—"}</td>
                                    ) : null}
                                    <td className={styles.num}>
                                      {entry.grade.letter ??
                                        formatPercent(entry.grade.percent)}
                                    </td>
                                    {hasCredits ? (
                                      <td className={styles.num}>
                                        {entry.credits ?? "—"}
                                      </td>
                                    ) : null}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            ) : null}

            {tab === "transcript" ? (
              <>
                {transcript.status === "idle" ||
                transcript.status === "loading" ? (
                  <LoadingSkeleton rows={2} />
                ) : transcript.status === "error" ? (
                  <div className={styles.emptyState} role="alert">
                    <span className={styles.emptyTitle}>
                      Transcript unavailable
                    </span>
                    <span>{transcript.message}</span>
                    <button
                      className={styles.panelAction}
                      onClick={() => setTranscript({ status: "idle" })}
                      type="button"
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const stats: Array<{
                        label: string;
                        value: string;
                        note: string | null;
                      }> = [];
                      if (
                        transcript.data.gpa.weighted !== null ||
                        transcript.data.gpa.unweighted !== null
                      ) {
                        stats.push({
                          label: "Weighted GPA",
                          value: String(transcript.data.gpa.weighted ?? "—"),
                          note:
                            transcript.data.gpa.unweighted !== null
                              ? `Unweighted ${transcript.data.gpa.unweighted}`
                              : null,
                        });
                      }
                      if (transcript.data.rank) {
                        stats.push({
                          label: "Class rank",
                          value: `#${transcript.data.rank.position}`,
                          note: `of ${transcript.data.rank.outOf}`,
                        });
                      }
                      if (transcript.data.creditsEarned !== null) {
                        stats.push({
                          label: "Credits earned",
                          value: formatPoints(transcript.data.creditsEarned),
                          note: `${transcript.data.entries.length} transcript entries`,
                        });
                      }
                      if (stats.length === 0) return null;

                      return (
                        <section
                          aria-label="Transcript summary"
                          className={`${styles.metrics} ${styles.transcriptMetrics}`}
                        >
                          {stats.map((stat, index) => (
                            <article
                              className={
                                index === 0
                                  ? `${styles.metric} ${styles.metricAccent}`
                                  : styles.metric
                              }
                              key={stat.label}
                            >
                              <span className={styles.metricLabel}>
                                {stat.label}
                              </span>
                              <span className={styles.metricValue}>
                                {stat.value}
                              </span>
                              {stat.note ? (
                                <span className={styles.metricNote}>
                                  {stat.note}
                                </span>
                              ) : null}
                            </article>
                          ))}
                        </section>
                      );
                    })()}

                    {transcript.data.entries.length === 0 ? (
                      <EmptyState
                        body="HAC returned no transcript entries."
                        title="No courses on record"
                      />
                    ) : (
                      <section className={styles.panel}>
                        <div className={styles.tableWrap}>
                          <table className={styles.dataTable}>
                            <thead>
                              <tr>
                                <th scope="col">Year</th>
                                <th scope="col">Course</th>
                                {transcriptHasTerm ? (
                                  <th scope="col">Term</th>
                                ) : null}
                                <th className={styles.num} scope="col">
                                  Grade
                                </th>
                                {transcriptHasCredits ? (
                                  <th className={styles.num} scope="col">
                                    Credits
                                  </th>
                                ) : null}
                              </tr>
                            </thead>
                            <tbody>
                              {transcript.data.entries.map((entry, index) => (
                                <tr
                                  key={`${entry.schoolYear}-${entry.courseName}-${index}`}
                                >
                                  <td>{entry.schoolYear}</td>
                                  <td>
                                    {entry.courseName}
                                    <span className={styles.tableNote}>
                                      {LEVEL_LABELS[entry.level]}
                                    </span>
                                  </td>
                                  {transcriptHasTerm ? (
                                    <td>{entry.term ?? ""}</td>
                                  ) : null}
                                  <td className={styles.num}>
                                    {entry.grade.letter ??
                                      formatPercent(entry.grade.percent)}
                                  </td>
                                  {transcriptHasCredits ? (
                                    <td className={styles.num}>
                                      {entry.credits && entry.credits > 0
                                        ? entry.credits
                                        : ""}
                                    </td>
                                  ) : null}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}
                  </>
                )}
              </>
            ) : null}
          </main>

          <footer className={styles.legalFooter}>{SITE.legalNotice}</footer>
        </div>
      </div>

      {selectedCourse ? (
        <CoursePanel
          course={selectedCourse}
          key={`${selectedCourse.id}:${markingPeriod ?? "current"}`}
          markingPeriodId={markingPeriod}
          onClose={closeCourse}
        />
      ) : null}
    </>
  );
}
