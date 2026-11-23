"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AttendanceDay,
  AttendanceStatus,
  CourseSummary,
  MeData,
  ReportCard,
  Snapshot,
  Transcript,
} from "@/lib/types";
import type { AppSettings } from "@/lib/client/storage";
import { apiGet, errorMessage, SessionLostError } from "@/components/workspace/api";
import {
  currentMonthKey,
  formatLongDate,
  formatMonth,
  formatPercent,
  formatPoints,
  parseIsoDate,
  shiftMonth,
} from "@/components/workspace/format";
import { EmptyState, Segmented, Skeleton } from "@/components/ui/ui";
import { SettingsScreen } from "./settings-screen";
import styles from "./app.module.css";

type MoreTab = "reports" | "transcript" | "attendance" | "teachers" | "settings";

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  tardy: "Tardy",
  excused: "Excused",
  remote: "Remote",
  no_school: "No school",
  unknown: "Unknown",
};

const ATTENDANCE_CLASS: Record<AttendanceStatus, string | undefined> = {
  present: styles.dayPresent,
  absent: styles.dayAbsent,
  tardy: styles.dayTardy,
  excused: styles.dayExcused,
  remote: styles.dayRemote,
  no_school: styles.dayNoSchool,
  unknown: styles.dayUnknown,
};

export function MoreScreen({
  me,
  courses,
  settings,
  setSettings,
  snapshots,
  notify,
  onSessionLost,
  onSignOut,
}: {
  me: MeData;
  courses: CourseSummary[];
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  snapshots: Snapshot[];
  notify: (message: string) => void;
  onSessionLost: () => void;
  onSignOut: () => void;
}) {
  const [tab, setTab] = useState<MoreTab>("reports");
  const [reports, setReports] = useState<ReportCard[] | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [attendance, setAttendance] = useState<AttendanceDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonthKey);

  useEffect(() => {
    if (tab !== "reports" || reports !== null) return;
    let cancelled = false;
    apiGet<ReportCard[]>("/api/reports")
      .then((result) => {
        if (!cancelled) setReports(result.data);
      })
      .catch((problem: unknown) => {
        if (cancelled) return;
        if (problem instanceof SessionLostError) {
          onSessionLost();
          return;
        }
        setError(errorMessage(problem));
      });
    return () => {
      cancelled = true;
    };
  }, [tab, reports, onSessionLost]);

  useEffect(() => {
    if (tab !== "transcript" || transcript !== null) return;
    let cancelled = false;
    apiGet<Transcript>("/api/transcript")
      .then((result) => {
        if (!cancelled) setTranscript(result.data);
      })
      .catch((problem: unknown) => {
        if (cancelled) return;
        if (problem instanceof SessionLostError) {
          onSessionLost();
          return;
        }
        setError(errorMessage(problem));
      });
    return () => {
      cancelled = true;
    };
  }, [tab, transcript, onSessionLost]);

  useEffect(() => {
    if (tab !== "attendance" || attendance !== null) return;
    let cancelled = false;
    apiGet<AttendanceDay[]>("/api/attendance")
      .then((result) => {
        if (!cancelled) setAttendance(result.data);
      })
      .catch((problem: unknown) => {
        if (cancelled) return;
        if (problem instanceof SessionLostError) {
          onSessionLost();
          return;
        }
        setError(errorMessage(problem));
      });
    return () => {
      cancelled = true;
    };
  }, [tab, attendance, onSessionLost]);

  const teachers = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{
      name: string;
      email: string | null;
      room: string | null;
      courses: string[];
    }> = [];
    for (const course of courses) {
      if (!course.teacher || seen.has(course.teacher.name)) {
        const existing = rows.find((row) => row.name === course.teacher?.name);
        if (existing) existing.courses.push(course.shortName ?? course.name);
        continue;
      }
      seen.add(course.teacher.name);
      rows.push({
        name: course.teacher.name,
        email: course.teacher.email,
        room: course.teacher.room,
        courses: [course.shortName ?? course.name],
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [courses]);

  return (
    <div className={styles.page}>
      <div className={styles.pageIntro}>
        <div>
          <p className={styles.eyebrowLine}>
            <span aria-hidden="true" />
            The rest of the record
          </p>
          <p className={styles.lede}>
            Reports, transcript, attendance and the people behind the courses.
          </p>
        </div>
      </div>

      <Segmented
        label="More sections"
        onChange={(next) => {
          setError(null);
          setTab(next);
        }}
        options={[
          { id: "reports", label: "Reports" },
          { id: "transcript", label: "Transcript" },
          { id: "attendance", label: "Attendance" },
          { id: "teachers", label: "Teachers" },
          { id: "settings", label: "Settings" },
        ]}
        value={tab}
      />

      {error ? (
        <div className={styles.errorBar} role="alert">
          <span>{error}</span>
          <button
            className={styles.textButton}
            onClick={() => {
              setError(null);
              setReports(null);
              setTranscript(null);
              setAttendance(null);
            }}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : null}

      {tab === "reports" ? (
        reports === null ? (
          <Skeleton rows={2} />
        ) : reports.length === 0 ? (
          <EmptyState body="HAC returned no report cards or progress reports." title="Nothing issued yet" />
        ) : (
          <div className={styles.reportList}>
            {reports.map((report) => (
              <Report key={report.id} report={report} />
            ))}
          </div>
        )
      ) : null}

      {tab === "transcript" ? (
        transcript === null ? (
          <Skeleton rows={3} />
        ) : (
          <>
            <section className={`${styles.panel} surface`} aria-label="Transcript summary">
              <div className={styles.transcriptStats}>
                <div>
                  <span className={styles.metricLabel}>Weighted GPA</span>
                  <span className={styles.metricValue}>{transcript.gpa.weighted ?? "—"}</span>
                </div>
                <div>
                  <span className={styles.metricLabel}>Unweighted GPA</span>
                  <span className={styles.metricValue}>{transcript.gpa.unweighted ?? "—"}</span>
                </div>
                <div>
                  <span className={styles.metricLabel}>Class rank</span>
                  <span className={styles.metricValue}>
                    {transcript.rank ? `#${transcript.rank.position}` : "—"}
                  </span>
                  <span className={styles.metricNote}>
                    {transcript.rank ? `of ${transcript.rank.outOf}` : "not published"}
                  </span>
                </div>
                <div>
                  <span className={styles.metricLabel}>Credits</span>
                  <span className={styles.metricValue}>
                    {transcript.creditsEarned !== null
                      ? formatPoints(transcript.creditsEarned)
                      : "—"}
                  </span>
                </div>
              </div>
            </section>

            {transcript.entries.length === 0 ? (
              <EmptyState body="HAC returned no transcript entries." title="No courses on record" />
            ) : (
              <section className={`${styles.panel} surface`}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className="sr-only">Transcript courses</caption>
                    <thead>
                      <tr>
                        <th scope="col">Year</th>
                        <th scope="col">Course</th>
                        <th scope="col">Term</th>
                        <th className={styles.num} scope="col">
                          Grade
                        </th>
                        <th className={styles.num} scope="col">
                          Credits
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transcript.entries.map((entry, index) => (
                        <tr key={`${entry.schoolYear}-${entry.courseName}-${index}`}>
                          <td>{entry.schoolYear}</td>
                          <td>{entry.courseName}</td>
                          <td>{entry.term ?? "—"}</td>
                          <td className={styles.num}>
                            {entry.grade.letter ?? formatPercent(entry.grade.percent)}
                          </td>
                          <td className={styles.num}>{entry.credits ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )
      ) : null}

      {tab === "attendance" ? (
        attendance === null ? (
          <Skeleton rows={2} />
        ) : (
          <AttendanceCalendar
            attendance={attendance}
            month={month}
            onMonth={(next) => setMonth(next)}
          />
        )
      ) : null}

      {tab === "teachers" ? (
        teachers.length === 0 ? (
          <EmptyState
            body="Teacher names and email addresses appear when HAC publishes them with a course."
            title="No directory yet"
          />
        ) : (
          <div className={styles.teacherGrid}>
            {teachers.map((teacher) => (
              <article className={`${styles.teacherCard} surface`} key={teacher.name}>
                <span className={styles.teacherAvatar} aria-hidden="true">
                  {teacher.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <div>
                  <h3 className={styles.teacherName}>{teacher.name}</h3>
                  <p className={styles.teacherMeta}>
                    {[teacher.room ? `Room ${teacher.room}` : null, teacher.courses.join(", ")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {teacher.email ? (
                  <a className={styles.secondaryButton} href={`mailto:${teacher.email}`}>
                    Email teacher
                  </a>
                ) : (
                  <span className={styles.muted}>No email published</span>
                )}
              </article>
            ))}
          </div>
        )
      ) : null}

      {tab === "settings" ? (
        <SettingsScreen
          me={me}
          notify={notify}
          onSignOut={onSignOut}
          setSettings={setSettings}
          settings={settings}
          snapshots={snapshots}
        />
      ) : null}
    </div>
  );
}

function Report({ report }: { report: ReportCard }) {
  const hasTeacher = report.entries.some((entry) => entry.teacherName !== null);
  const hasCredits = report.entries.some((entry) => entry.credits !== null);
  return (
    <article className={`${styles.reportCard} surface`}>
      <div className={styles.reportHead}>
        <span className={styles.reportKind}>
          {report.kind === "report_card" ? "Report card" : "Progress report"}
        </span>
        <span className={styles.muted}>
          {report.issuedDate ? formatLongDate(report.issuedDate) : "No issue date"}
        </span>
      </div>
      <h2 className={styles.panelTitle}>{report.title}</h2>
      <p className={styles.muted}>
        {[report.schoolYear, `${report.entries.length} courses`].filter(Boolean).join(" · ")}
      </p>
      <div className={styles.reportStats}>
        {report.gpa !== null ? (
          <div>
            <span className={styles.metricLabel}>GPA</span>
            <span className={styles.reportStat}>{report.gpa}</span>
          </div>
        ) : null}
        {report.absences !== null ? (
          <div>
            <span className={styles.metricLabel}>Absences</span>
            <span className={styles.reportStat}>{report.absences}</span>
          </div>
        ) : null}
        {report.tardies !== null ? (
          <div>
            <span className={styles.metricLabel}>Tardies</span>
            <span className={styles.reportStat}>{report.tardies}</span>
          </div>
        ) : null}
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="sr-only">{report.title}</caption>
          <thead>
            <tr>
              <th scope="col">Course</th>
              {hasTeacher ? <th scope="col">Teacher</th> : null}
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
              <tr key={`${entry.courseId ?? entry.courseName}-${index}`}>
                <td>{entry.courseName}</td>
                {hasTeacher ? <td>{entry.teacherName ?? "—"}</td> : null}
                <td className={styles.num}>
                  {entry.grade.letter ?? formatPercent(entry.grade.percent)}
                </td>
                {hasCredits ? <td className={styles.num}>{entry.credits ?? "—"}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function AttendanceCalendar({
  attendance,
  month,
  onMonth,
}: {
  attendance: AttendanceDay[];
  month: string;
  onMonth: (month: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const grid = useMemo(() => {
    const [yearText = "2026", monthText = "1"] = month.split("-");
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const first = new Date(year, monthIndex, 1, 12);
    const total = new Date(year, monthIndex + 1, 0, 12).getDate();
    const cells: Array<string | null> = Array.from({ length: first.getDay() }, () => null);
    for (let day = 1; day <= total; day += 1) {
      cells.push(
        `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      );
    }
    return cells;
  }, [month]);

  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceDay>();
    for (const day of attendance) map.set(day.date, day);
    return map;
  }, [attendance]);

  const summary = useMemo(() => {
    const counts = new Map<AttendanceStatus, number>();
    for (const day of attendance) {
      if (!day.date.startsWith(`${month}-`)) continue;
      counts.set(day.status, (counts.get(day.status) ?? 0) + 1);
    }
    return counts;
  }, [attendance, month]);

  const selectedDay = selected ? byDate.get(selected) : null;

  return (
    <section className={`${styles.panel} surface`} aria-labelledby="attendance-title">
      <div className={styles.panelHead}>
        <div>
          <span className={styles.panelKicker}>Attendance</span>
          <h2 className={styles.panelTitle} id="attendance-title">
            {formatMonth(month)}
          </h2>
        </div>
        <div className={styles.monthButtons}>
          <button
            aria-label="Previous month"
            className={styles.iconButton}
            onClick={() => onMonth(shiftMonth(month, -1))}
            type="button"
          >
            ←
          </button>
          <button
            aria-label="Next month"
            className={styles.iconButton}
            onClick={() => onMonth(shiftMonth(month, 1))}
            type="button"
          >
            →
          </button>
        </div>
      </div>

      <div className={styles.weekdayRow} aria-hidden="true">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className={styles.calendar}>
        {grid.map((date, index) => {
          if (!date) return <span className={styles.dayBlank} key={`blank-${index}`} />;
          const day = byDate.get(date);
          const number = parseIsoDate(date).getDate();
          if (!day) {
            return (
              <span className={styles.dayEmpty} key={date}>
                {number}
              </span>
            );
          }
          return (
            <button
              aria-label={`${formatLongDate(date)}: ${ATTENDANCE_LABELS[day.status]}`}
              aria-pressed={selected === date}
              className={`${styles.day} ${ATTENDANCE_CLASS[day.status]} ${
                selected === date ? styles.daySelected : ""
              }`}
              key={date}
              onClick={() => setSelected(date)}
              type="button"
            >
              <span>{number}</span>
              <small>{day.status === "present" ? "P" : day.code ?? "·"}</small>
            </button>
          );
        })}
      </div>

      <div className={styles.legend}>
        {(
          ["present", "absent", "tardy", "excused", "remote", "no_school"] as AttendanceStatus[]
        ).map((status) => (
          <span key={status}>
            <i aria-hidden="true" className={ATTENDANCE_CLASS[status]} />
            {ATTENDANCE_LABELS[status]}
            {summary.get(status) ? ` (${summary.get(status)})` : ""}
          </span>
        ))}
      </div>

      {selectedDay ? (
        <div className={styles.dayDetail} role="status">
          <strong>{formatLongDate(selectedDay.date)}</strong>
          <span>{ATTENDANCE_LABELS[selectedDay.status]}</span>
          {selectedDay.reason ? <span>{selectedDay.reason}</span> : null}
          {selectedDay.note ? <span>{selectedDay.note}</span> : null}
          {selectedDay.periods.length > 0 ? (
            <ul>
              {selectedDay.periods.map((period) => (
                <li key={`${period.period}-${period.status}`}>
                  Period {period.period}: {ATTENDANCE_LABELS[period.status]}
                  {period.reason ? ` · ${period.reason}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
