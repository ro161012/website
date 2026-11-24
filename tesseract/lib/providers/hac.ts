import * as cheerio from "cheerio";
import {
  type AssignmentWithCourse,
  type AttendanceDay,
  type Course,
  type CourseSummary,
  type MarkingPeriod,
  type MeData,
  type ReportCard,
  type Student,
  type Transcript,
  type Warning,
} from "@/lib/types";
import {
  ForbiddenHostProblem,
  NotFoundProblem,
  ParseProblem,
  SessionExpiredProblem,
  UpstreamProblem,
} from "@/lib/security/errors";
import { CookieJar } from "@/lib/hac/cookies";
import { extractForm } from "@/lib/hac/html-form";
import { fetchHacPage, type HacResponse } from "@/lib/hac/http";
import {
  findExplicitStudentName,
  isLoginPage,
  namesMatch,
  parseStudentChoices,
  selectStudentIfNeeded,
} from "@/lib/hac/auth";
import {
  mergeClassSchedule,
  parseAttendance,
  parseClassScheduleTable,
  parseMarkingPeriods,
  parseReportCards,
  parseSchedule,
  parseTranscript,
  readMarkingPeriodOptions,
  type ClassScheduleEntry,
} from "@/lib/hac/parsers";
import { getProfileById, type DistrictProfile } from "@/lib/hac/profiles";
import { joinHacPath } from "@/lib/hac/url";
import type { Session } from "@/lib/session/schema";
import { cached, providerCacheKey } from "./cache";
import type { DataProvider, ProviderResult } from "./types";

const EMPTY_TRANSCRIPT: Transcript = {
  gpa: { weighted: null, unweighted: null },
  rank: null,
  creditsEarned: null,
  entries: [],
};

interface LoadedSchedule {
  html: string;
  courses: Course[];
  markingPeriods: MarkingPeriod[];
  activeMarkingPeriodId: string;
  warnings: Warning[];
}

interface LoadedClassSchedule {
  entries: ClassScheduleEntry[];
  warnings: Warning[];
}

function cleanText(value: string | undefined | null): string {
  return (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function calendarMonthKey(html: string): string | null {
  const $ = cheerio.load(html);
  const label = cleanText(
    $("table.sg-asp-calendar-header td[align='center']").first().text(),
  );
  const match = /([A-Za-z]{3,9})\s+(\d{4})/.exec(label);
  if (!match) return null;
  const date = new Date(`${match[1]} 1, ${match[2]} 00:00:00 UTC`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 7);
}

function schoolYearStart(monthKey: string): string {
  const [yearText = "", monthText = ""] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  return `${month >= 8 ? year : year - 1}-08`;
}

function summaryOf(course: Course): CourseSummary {
  return {
    id: course.id,
    markingPeriodId: course.markingPeriodId,
    name: course.name,
    shortName: course.shortName,
    teacher: course.teacher,
    period: course.period,
    room: course.room,
    level: course.level,
    credits: course.credits,
    grade: course.grade,
    classAverage: course.classAverage,
    position: course.position,
  };
}

function fetchedAt(): string {
  return new Date().toISOString();
}

function result<T>(
  data: T,
  warnings: Warning[],
  jar: CookieJar,
): ProviderResult<T> {
  return {
    data,
    warnings,
    fetchedAt: fetchedAt(),
    cookies: jar.toJson(),
  };
}

export class HacProvider implements DataProvider {
  readonly mode = "hac" as const;
  private readonly session: Session;
  private readonly profile: DistrictProfile;
  private readonly jar: CookieJar;

  constructor(session: Session) {
    this.session = session;
    this.profile = getProfileById(session.district.profileId);
    this.jar = CookieJar.fromJson(session.cookies);
  }

  private async getPage(url: URL, referer?: URL): Promise<HacResponse> {
    const response = await fetchHacPage({
      url,
      jar: this.jar,
      profile: this.profile,
      referer,
    });
    if (isLoginPage(response.html)) {
      throw new SessionExpiredProblem();
    }
    return response;
  }

  private load<T>(
    suffix: string,
    compute: () => Promise<ProviderResult<T>>,
  ): Promise<ProviderResult<T>> {
    return cached(providerCacheKey(this.session, suffix), compute);
  }

  /**
   * The schedule page is the expensive shared read: me, courses, upcoming and
   * every course detail all need it. Cache it once per marking period so a
   * normal dashboard boot makes one schedule request instead of four.
   */
  private async schedule(
    markingPeriodId?: string | null,
  ): Promise<LoadedSchedule> {
    const current = await cached(
      providerCacheKey(this.session, "schedule:current"),
      () => this.loadSchedule(null),
    );
    if (!markingPeriodId || markingPeriodId === current.activeMarkingPeriodId) {
      return current;
    }
    return cached(
      providerCacheKey(this.session, `schedule:${markingPeriodId}`),
      () => this.loadSchedule(markingPeriodId),
    );
  }

  private async switchMarkingPeriod(
    html: string,
    pageUrl: URL,
    targetId: string,
  ): Promise<string> {
    const options = readMarkingPeriodOptions(html, this.profile);
    const target = options.find((option) => option.id === targetId);
    if (!target) {
      throw new NotFoundProblem("That marking period is not available from HAC.");
    }

    const $ = cheerio.load(html);
    const $select = $(this.profile.selectors.markingPeriodSelect).first();
    const selectName = cleanText($select.attr("name"));
    if (!selectName) {
      throw new UpstreamProblem("HAC did not expose a usable marking-period selector.");
    }

    const escapedName = selectName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const form = extractForm(html, {
      pageUrl,
      formSelector: `form:has(select[name="${escapedName}"])`,
      fallbackToFirstForm: false,
      fieldOverrides: { [selectName]: target.value },
      includePasswords: false,
    });

    if (!form || form.method !== "POST") {
      throw new UpstreamProblem("HAC did not expose a usable marking-period form.");
    }
    if (form.action.origin !== pageUrl.origin) {
      throw new ParseProblem("The marking-period form submits to another host.");
    }

    const fields = { ...form.fields };
    if (target.postBackTarget) {
      fields.__EVENTTARGET = target.postBackTarget;
      fields.__EVENTARGUMENT = "";
    }

    const posted = await fetchHacPage({
      url: form.action,
      jar: this.jar,
      profile: this.profile,
      method: "POST",
      form: fields,
      referer: pageUrl,
    });
    if (isLoginPage(posted.html)) {
      throw new SessionExpiredProblem();
    }
    const updatedOptions = readMarkingPeriodOptions(posted.html, this.profile);
    const selected = updatedOptions.find((option) => option.id === targetId);
    if (!selected?.selected) {
      throw new UpstreamProblem(
        "HAC did not confirm the marking-period change. Reload and try again.",
      );
    }
    return posted.html;
  }

  private async loadClassSchedule(): Promise<LoadedClassSchedule> {
    const warnings: Warning[] = [];
    try {
      const url = joinHacPath(
        this.session.district.baseUrl,
        this.profile.paths.classSchedule,
      );
      const response = await this.getPage(
        url,
        joinHacPath(this.session.district.baseUrl, this.profile.paths.home),
      );
      return { entries: parseClassScheduleTable(response.html), warnings };
    } catch (error) {
      if (error instanceof SessionExpiredProblem) throw error;
      if (error instanceof ForbiddenHostProblem) throw error;
      if (!isRecoverableUpstreamError(error)) throw error;
      warnings.push({
        code: "class_schedule_unavailable",
        message:
          "The class schedule was unavailable; course periods, teachers and rooms may be blank.",
      });
      return { entries: [], warnings };
    }
  }

  private async loadSchedule(markingPeriodId?: string | null): Promise<LoadedSchedule> {
    const scheduleUrl = joinHacPath(
      this.session.district.baseUrl,
      this.profile.paths.schedule,
    );
    const [response, classSchedule] = await Promise.all([
      this.getPage(scheduleUrl),
      this.loadClassSchedule(),
    ]);
    const firstParse = parseMarkingPeriods(response.html, this.profile);
    const current =
      firstParse.markingPeriods.find((period) => period.isCurrent) ??
      firstParse.markingPeriods[0];

    if (!current) {
      throw new ParseProblem("HAC returned no marking periods.");
    }

    const targetId = markingPeriodId ?? current.id;
    const known = firstParse.markingPeriods.some((period) => period.id === targetId);
    if (!known) {
      throw new NotFoundProblem("That marking period is not available from HAC.");
    }

    let html = response.html;
    let finalUrl = response.finalUrl;
    const warnings: Warning[] = [...firstParse.warnings];

    if (targetId !== current.id) {
      html = await this.switchMarkingPeriod(response.html, response.finalUrl, targetId);
      finalUrl = scheduleUrl;
    }

    const parsed = parseSchedule(html, finalUrl, targetId, this.profile);
    warnings.push(...parsed.warnings, ...classSchedule.warnings);

    return {
      html,
      courses: mergeClassSchedule(parsed.courses, classSchedule.entries),
      markingPeriods: parsed.markingPeriods,
      activeMarkingPeriodId:
        parsed.markingPeriods.find((period) => period.id === targetId)?.id ??
        parsed.markingPeriods.find((period) => period.isCurrent)?.id ??
        targetId,
      warnings: dedupeWarnings(warnings),
    };
  }

  getMe(): Promise<ProviderResult<MeData>> {
    return this.load("me", async () => {
      const schedule = await this.schedule(null);
      const student =
        this.session.students.find(
          (candidate) => candidate.id === this.session.activeStudentId,
        ) ?? this.session.students[0];

      if (!student) throw new NotFoundProblem("No student is attached to this session.");

      return result(
        {
          mode: this.mode,
          student,
          students: this.session.students,
          district: this.session.district,
          markingPeriods: schedule.markingPeriods,
          activeMarkingPeriodId: schedule.activeMarkingPeriodId,
        },
        schedule.warnings,
        this.jar,
      );
    });
  }

  getCourses(markingPeriodId?: string | null): Promise<ProviderResult<CourseSummary[]>> {
    return this.load(`courses:${markingPeriodId ?? "current"}`, async () => {
      const schedule = await this.schedule(markingPeriodId);
      return result(
        schedule.courses.map(summaryOf),
        schedule.warnings,
        this.jar,
      );
    });
  }

  getCourse(
    courseId: string,
    markingPeriodId?: string | null,
  ): Promise<ProviderResult<Course>> {
    return this.load(`course:${markingPeriodId ?? "current"}:${courseId}`, async () => {
      const schedule = await this.schedule(markingPeriodId);
      let course = schedule.courses.find((candidate) => candidate.id === courseId);
      const scheduledName = course?.name;
      const warnings = [...schedule.warnings];

      if (
        !course ||
        course.categories.length === 0 ||
        course.assignments.length === 0
      ) {
        try {
          const classworkUrl = joinHacPath(
            this.session.district.baseUrl,
            this.profile.paths.classwork,
          );
          const classwork = await this.getPage(classworkUrl);
          const fallback = parseSchedule(
            classwork.html,
            classwork.finalUrl,
            schedule.activeMarkingPeriodId,
            this.profile,
          );
          warnings.push(...fallback.warnings);
          const fallbackCourse =
            fallback.courses.find((candidate) => candidate.id === courseId) ??
            (scheduledName
              ? fallback.courses.find((candidate) => candidate.name === scheduledName)
              : undefined);
          if (fallbackCourse && fallbackCourse.assignments.length > 0) {
            course = fallbackCourse;
          }
        } catch (error) {
          if (error instanceof SessionExpiredProblem) throw error;
          if (error instanceof ForbiddenHostProblem) throw error;
          if (!isRecoverableUpstreamError(error)) throw error;
          warnings.push({
            code: "classwork_unavailable",
            message:
              "The course detail page was unavailable; using the schedule data.",
          });
        }
      }

      if (!course) throw new NotFoundProblem("That course was not found in HAC.");
      return result(course, dedupeWarnings(warnings), this.jar);
    });
  }

  getUpcomingAssignments(
    days = 14,
  ): Promise<ProviderResult<AssignmentWithCourse[]>> {
    return this.load(`upcoming:${days}`, async () => {
      const schedule = await this.schedule(null);
      const start = new Date().toISOString().slice(0, 10);
      const end = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
      const assignments: AssignmentWithCourse[] = [];

      for (const course of schedule.courses) {
        for (const assignment of course.assignments) {
          if (!assignment.dueDate) continue;
          if (assignment.dueDate < start || assignment.dueDate > end) continue;
          if (assignment.status === "exempt") continue;
          assignments.push({ ...assignment, courseName: course.name });
        }
      }

      assignments.sort(
        (a, b) =>
          (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
          a.courseName.localeCompare(b.courseName),
      );

      return result(assignments, schedule.warnings, this.jar);
    });
  }

  getAttendance(month?: string | null): Promise<ProviderResult<AttendanceDay[]>> {
    return this.load("attendance:school-year", async () => {
      const warnings: Warning[] = [];
      const attendanceUrl = joinHacPath(
        this.session.district.baseUrl,
        this.profile.paths.attendance,
      );
      let html = "";
      let pageUrl = attendanceUrl;

      try {
        const response = await this.getPage(
          attendanceUrl,
          joinHacPath(this.session.district.baseUrl, this.profile.paths.home),
        );
        html = response.html;
        pageUrl = response.finalUrl;
      } catch (error) {
        if (error instanceof SessionExpiredProblem) throw error;
        if (error instanceof ForbiddenHostProblem) throw error;
        if (!isRecoverableUpstreamError(error)) throw error;
        warnings.push({
          code: "attendance_page_unavailable",
          message: "The attendance page was unavailable; trying the HAC home page.",
        });
      }

      if (!html) {
        try {
          const homeUrl = joinHacPath(
            this.session.district.baseUrl,
            this.profile.paths.home,
          );
          const home = await this.getPage(homeUrl);
          html = home.html;
          pageUrl = home.finalUrl;
        } catch (error) {
          if (error instanceof SessionExpiredProblem) throw error;
          if (error instanceof ForbiddenHostProblem) throw error;
          if (!isRecoverableUpstreamError(error)) throw error;
          return result([], warnings, this.jar);
        }
      }

      const days: AttendanceDay[] = [];
      const seen = new Set<string>();
      let currentHtml = html;
      let currentUrl = pageUrl;
      let firstMonthKey: string | null = null;
      let startKey = "";

      for (let index = 0; index < 14; index += 1) {
        const parsed = parseAttendance(currentHtml, this.profile);
        warnings.push(
          ...(index === 0
            ? parsed.warnings
            : parsed.warnings.filter((warning) => warning.code !== "attendance_empty")),
        );
        for (const day of parsed.days) {
          if (seen.has(day.date)) continue;
          seen.add(day.date);
          days.push(day);
        }

        if (!this.profile.quirks.attendanceCalendar) break;

        const monthKey = calendarMonthKey(currentHtml);
        if (!monthKey) break;
        firstMonthKey ??= monthKey;
        startKey ||= schoolYearStart(firstMonthKey);
        if (monthKey <= startKey) break;

        const $ = cheerio.load(currentHtml);
        const previousHref =
          $("a[title='Go to the previous month']").first().attr("href") ?? "";
        const postBack =
          /__doPostBack\(\s*'([^']+)'\s*,\s*'([^']*)'\s*\)/.exec(previousHref);
        if (!postBack) break;

        const form = extractForm(currentHtml, {
          pageUrl: currentUrl,
          formSelector: "form",
          fallbackToFirstForm: true,
          fieldOverrides: {
            __EVENTTARGET: postBack[1] ?? "",
            __EVENTARGUMENT: postBack[2] ?? "",
          },
          includePasswords: false,
        });
        if (!form || form.method !== "POST") break;

        try {
          const previous = await fetchHacPage({
            url: form.action,
            jar: this.jar,
            profile: this.profile,
            method: "POST",
            form: form.fields,
            referer: currentUrl,
          });
          if (isLoginPage(previous.html)) throw new SessionExpiredProblem();
          currentHtml = previous.html;
          currentUrl = attendanceUrl;
        } catch (error) {
          if (error instanceof SessionExpiredProblem) throw error;
          if (error instanceof ForbiddenHostProblem) throw error;
          if (!isRecoverableUpstreamError(error)) throw error;
          warnings.push({
            code: "attendance_month_navigation",
            message:
              "HAC did not return every earlier attendance month; showing the months it did return.",
          });
          break;
        }
      }

      days.sort((a, b) => a.date.localeCompare(b.date));
      return result(days, dedupeWarnings(warnings), this.jar);
    }).then((loaded): ProviderResult<AttendanceDay[]> => {
      if (!month) return loaded;
      return {
        ...loaded,
        data: loaded.data.filter((day) => day.date.startsWith(`${month}-`)),
      };
    });
  }

  getReports(): Promise<ProviderResult<ReportCard[]>> {
    return this.load("reports", async () => {
      const warnings: Warning[] = [];
      try {
        const reportUrl = joinHacPath(
          this.session.district.baseUrl,
          this.profile.paths.reportCard,
        );
        const response = await this.getPage(reportUrl);
        const parsed = parseReportCards(response.html, this.profile);
        warnings.push(...parsed.warnings);
        if (parsed.reports.length > 0) {
          return result(parsed.reports, dedupeWarnings(warnings), this.jar);
        }
      } catch (error) {
        if (error instanceof SessionExpiredProblem) throw error;
        if (error instanceof ForbiddenHostProblem) throw error;
        if (!isRecoverableUpstreamError(error)) throw error;
        warnings.push({
          code: "reports_unavailable",
          message: "The report-card page was unavailable; trying classwork.",
        });
      }

      const schedule = await this.loadSchedule(null);
      const parsed = parseReportCards(schedule.html, this.profile);
      return result(
        parsed.reports,
        dedupeWarnings([...warnings, ...schedule.warnings, ...parsed.warnings]),
        this.jar,
      );
    });
  }

  getTranscript(): Promise<ProviderResult<Transcript>> {
    return this.load("transcript", async () => {
      const warnings: Warning[] = [];
      try {
        const transcriptUrl = joinHacPath(
          this.session.district.baseUrl,
          this.profile.paths.transcript,
        );
        const response = await this.getPage(transcriptUrl);
        const parsed = parseTranscript(response.html, this.profile);
        return result(parsed.transcript, parsed.warnings, this.jar);
      } catch (error) {
        if (error instanceof SessionExpiredProblem) throw error;
        if (error instanceof ForbiddenHostProblem) throw error;
        if (!isRecoverableUpstreamError(error)) throw error;
        warnings.push({
          code: "transcript_unavailable",
          message: "The transcript page was unavailable from this HAC.",
        });
        return result(EMPTY_TRANSCRIPT, warnings, this.jar);
      }
    });
  }

  switchStudent(studentId: string): Promise<ProviderResult<Student>> {
    return this.load(`switch:${studentId}`, async () => {
      const homeUrl = joinHacPath(
        this.session.district.baseUrl,
        this.profile.paths.home,
      );
      const home = await this.getPage(homeUrl);
      const choices = parseStudentChoices(home.html, this.profile);
      const selected = choices.find((choice) => choice.student.id === studentId);
      if (!selected) {
        throw new NotFoundProblem(
          "That student is not available in the current HAC session.",
        );
      }

      let html = await selectStudentIfNeeded(
        choices,
        selected,
        home.html,
        home.finalUrl,
        this.jar,
        this.profile,
      );
      if (isLoginPage(html)) throw new SessionExpiredProblem();

      // Do not claim a switch just because a form posted. HAC must expose the
      // selected student's name; otherwise a stale student's grades could be
      // written into the newly active session.
      let confirmed = findExplicitStudentName(html);
      if (!confirmed) {
        const after = await this.getPage(homeUrl);
        html = after.html;
        confirmed = findExplicitStudentName(html);
      }
      if (!confirmed || !namesMatch(confirmed, selected.student.displayName)) {
        // The postback may already have changed HAC's server-side student
        // state. Keeping the old session could show one student's grades under
        // another student's name, so invalidate it and require a fresh login.
        throw new SessionExpiredProblem();
      }

      return result(selected.student, [], this.jar);
    });
  }
}

function isRecoverableUpstreamError(error: unknown): boolean {
  return error instanceof UpstreamProblem || error instanceof ParseProblem;
}

function dedupeWarnings(warnings: Warning[]): Warning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}|${warning.message}|${warning.path ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
