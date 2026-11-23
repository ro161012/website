import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import {
  AttendanceDaySchema,
  CourseSchema,
  ReportCardSchema,
  TranscriptSchema,
  type Assignment,
  type AttendanceDay,
  type Category,
  type Course,
  type CourseLevel,
  type Grade,
  type MarkingPeriod,
  type ReportCard,
  type Teacher,
  type Transcript,
  type Warning,
} from "@/lib/types";
import type { DistrictProfile } from "./profiles";


function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha256").update(value).digest("base64url").slice(0, 18)}`;
}

function cleanText(value: string | undefined | null): string {
  return (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function firstText(
  $: cheerio.CheerioAPI,
  scope: cheerio.Cheerio<AnyNode>,
  selector: string,
): string {
  return cleanText(scope.find(selector).first().text());
}

function parseNumber(value: string): number | null {
  const match = /-?\d+(?:\.\d+)?/.exec(value.replace(/,/g, ""));
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampPercent(value: number | null): number | null {
  if (value === null) return null;
  return Math.max(0, Math.min(1000, value));
}

function parsePercent(value: string): number | null {
  const parsed = parseNumber(value);
  return parsed === null ? null : clampPercent(parsed);
}

function parseWeightPercent(value: string): number | null {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  // Some HAC grids express a category weight as a fraction (0.6 = 60%).
  if (!value.includes("%") && parsed > 0 && parsed <= 1) {
    return clampPercent(parsed * 100);
  }
  return clampPercent(parsed);
}

function parseGrade(value: string): Grade {
  const text = cleanText(value);
  const percent = parsePercent(text);
  const letterMatch = /\b([A-F][+-]?)\b/i.exec(text.replace(/\d+(?:\.\d+)?%?/g, " "));
  return {
    percent,
    letter: letterMatch?.[1]?.toUpperCase() ?? null,
  };
}

function parseDate(value: string): string | null {
  const text = cleanText(value);
  if (!text) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) {
    const date = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  const numeric = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(text);
  if (numeric) {
    const year = Number(numeric[3]);
    const fullYear = year < 100 ? 2000 + year : year;
    const date = new Date(Date.UTC(fullYear, Number(numeric[1]) - 1, Number(numeric[2])));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  const parsed = Date.parse(`${text} 00:00:00 UTC`);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function courseLevelFromName(name: string): CourseLevel {
  const value = name.toUpperCase();
  if (/\bAP\b|ADVANCED PLACEMENT|^AP(?=[A-Z])/.test(value)) return "ap";
  if (/\bIB\b|INTERNATIONAL BACCALAUREATE|^IB(?=[A-Z])/.test(value)) return "ib";
  if (/DUAL[ -]?ENROLL|DUAL[ -]?CREDIT/.test(value)) return "dual_enrollment";
  if (/HONORS|\bHON\b/.test(value)) return "honors";
  return "regular";
}

export function parseTeacher(value: string): Teacher | null {
  const text = cleanText(value);
  if (!text) return null;
  const name = text.replace(/^teacher\s*:\s*/i, "").split(/\r?\n/)[0]?.trim() ?? "";
  if (!name || name.length > 120) return null;
  return {
    name,
    email: null,
    phone: null,
    room: null,
  };
}

export interface ParseScheduleResult {
  courses: Course[];
  markingPeriods: MarkingPeriod[];
  warnings: Warning[];
}

export interface MarkingPeriodOption {
  id: string;
  value: string;
  label: string;
  selected: boolean;
  postBackTarget: string | null;
}

export function readMarkingPeriodOptions(
  html: string,
  profile: DistrictProfile,
): MarkingPeriodOption[] {
  const $ = cheerio.load(html);
  const $select = $(profile.selectors.markingPeriodSelect).first();
  const onchange = $select.attr("onchange") ?? "";
  const postBackTarget =
    /__doPostBack\(\s*['"]([^'"]+)['"]/.exec(onchange)?.[1] ?? null;
  const options = $select.find("option").toArray();
  const hasSelected = options.some(
    (option) => $(option).attr("selected") !== undefined,
  );

  return options.flatMap((option, index) => {
    const $option = $(option);
    const rawLabel = cleanText($option.text());
    const value = cleanText($option.attr("value")) || rawLabel;
    if (
      !rawLabel ||
      /^select\b/i.test(rawLabel) ||
      /^\(all\b/i.test(rawLabel) ||
      value === "-1"
    ) {
      return [];
    }
    const prefix = profile.quirks.markingPeriodLabelPrefix;
    const label = prefix ? `${prefix} ${rawLabel}` : rawLabel;
    return [
      {
        id: stableId("mp", `${value}|${label}`),
        value,
        label,
        selected:
          $option.attr("selected") !== undefined || (!hasSelected && index === 0),
        postBackTarget,
      },
    ];
  });
}

export function parseMarkingPeriods(
  html: string,
  profile: DistrictProfile,
): { markingPeriods: MarkingPeriod[]; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const options = readMarkingPeriodOptions(html, profile);

  if (options.length === 0) {
    warnings.push({
      code: "marking_period_select_missing",
      message:
        "No marking-period selector was found on the HAC page. Showing the page's current period.",
    });
    return {
      markingPeriods: [
        {
          id: "mp_current",
          name: "Current marking period",
          shortName: null,
          sequence: 0,
          startDate: null,
          endDate: null,
          isCurrent: true,
        },
      ],
      warnings,
    };
  }

  const markingPeriods: MarkingPeriod[] = [];
  const seen = new Set<string>();

  options.forEach((option, index) => {
    if (seen.has(option.id)) return;
    seen.add(option.id);

    markingPeriods.push({
      id: option.id,
      name: option.label,
      shortName: option.label.length <= 40 ? option.label : null,
      sequence: index,
      startDate: null,
      endDate: null,
      isCurrent: option.selected,
    });
  });

  if (markingPeriods.length === 0) {
    return {
      markingPeriods: [
        {
          id: "mp_current",
          name: "Current marking period",
          shortName: null,
          sequence: 0,
          startDate: null,
          endDate: null,
          isCurrent: true,
        },
      ],
      warnings: [
        {
          code: "marking_period_options_empty",
          message: "The marking-period selector had no readable options.",
        },
      ],
    };
  }

  if (!markingPeriods.some((period) => period.isCurrent)) {
    const first = markingPeriods[0];
    if (first) first.isCurrent = true;
  }

  return { markingPeriods, warnings };
}

function findCourseHref(
  $: cheerio.CheerioAPI,
  $course: cheerio.Cheerio<AnyNode>,
  pageUrl: URL,
): URL | null {
  const href = $course.find("a[href]").first().attr("href");
  if (!href) return null;
  try {
    const url = new URL(href, pageUrl);
    return url.origin === pageUrl.origin ? url : null;
  } catch {
    return null;
  }
}

function parseCourse(
  $: cheerio.CheerioAPI,
  $course: cheerio.Cheerio<AnyNode>,
  courseId: string,
  markingPeriodId: string,
  position: number,
  profile: DistrictProfile,
): { course: Course | null; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const title =
    firstText($, $course, profile.selectors.courseTitle) ||
    cleanText($course.find("h2, h3").first().text());
  const name = title || "Untitled course";
  const headerText = cleanText($course.find(".sg-header").first().text());
  const teacher =
    parseTeacher(firstText($, $course, profile.selectors.courseTeacher)) ??
    parseTeacher(/teacher\s*:\s*([^|]+)/i.exec(headerText)?.[1] ?? "");

  const room =
    cleanText($course.find(profile.selectors.courseRoom).first().text()) ||
    /room\s*:\s*([A-Za-z0-9 .-]+)/i.exec(headerText)?.[1]?.trim() ||
    null;

  const period =
    cleanText($course.find(profile.selectors.coursePeriod).first().text()) ||
    /period\s*:\s*([A-Za-z0-9 .-]+)/i.exec(headerText)?.[1]?.trim() ||
    null;

  const averageText =
    cleanText($course.find(profile.selectors.courseAverage).last().text()) ||
    (/:(\s*-?\d+(?:\.\d+)?%?)/.exec(headerText)?.[1] ?? "");
  const grade = parseGrade(averageText);

  const categories: Category[] = [];
  const categoryIdByName = new Map<string, string>();
  const $categoryTable = $course.find(profile.selectors.categoryTable).first();

  if ($categoryTable.length > 0) {
    const rows = $categoryTable.find(profile.selectors.categoryRow).toArray();
    rows.forEach((row, index) => {
      const $row = $(row);
      const categoryName = cleanText($row.find(profile.selectors.categoryName).first().text());
      if (
        !categoryName ||
        /^category$/i.test(categoryName) ||
        /^total(?:\s+points)?:?$/i.test(categoryName)
      ) {
        return;
      }

      const weightText = cleanText($row.find(profile.selectors.categoryWeight).first().text());
      const averageTextValue = cleanText(
        $row.find(profile.selectors.categoryAverage).first().text(),
      );
      const categoryId = stableId("cat", `${courseId}|${categoryName}|${index}`);
      if (categoryIdByName.has(categoryName)) return;
      categoryIdByName.set(categoryName, categoryId);

      categories.push({
        id: categoryId,
        name: categoryName,
        weightPercent: parseWeightPercent(weightText),
        pointsEarned: null,
        pointsPossible: null,
        averagePercent: parsePercent(averageTextValue),
        position: index,
        assignmentIds: [],
      });
    });
  } else {
    warnings.push({
      code: "categories_missing",
      message: `No category table was found for ${name}.`,
      path: "courses.categories",
    });
  }

  const assignments: Assignment[] = [];
  const $assignmentTable = $course.find(profile.selectors.assignmentTable).first();

  if ($assignmentTable.length > 0) {
    const rows = $assignmentTable.find(profile.selectors.assignmentRow).toArray();
    let positionIndex = 0;

    for (const row of rows) {
      const $row = $(row);
      const cells = $row.find("td").toArray();
      if (cells.length < 2) continue;

      const assignmentName =
        cleanText($row.find(profile.selectors.assignmentName).first().text()) ||
        cleanText($(cells[0]).text());
      if (!assignmentName || /^assignment$/i.test(assignmentName)) continue;

      const dueText =
        cleanText($row.find(profile.selectors.assignmentDue).first().text()) ||
        cleanText($(cells[1]).text());
      const categoryName =
        cleanText($row.find(profile.selectors.assignmentCategory).first().text()) ||
        cleanText($(cells[2]).text());
      const scoreText =
        cleanText($row.find(profile.selectors.assignmentScore).first().text()) ||
        cleanText($(cells[3]).text());
      const pointsPossibleText = cleanText(
        $row.find(profile.selectors.assignmentPointsPossible).first().text(),
      );
      const statusText =
        cleanText($row.find(profile.selectors.assignmentStatus).first().text()) ||
        cleanText($(cells[4] ?? cells[cells.length - 1] ?? cells[0]).text());

      const dueDate = parseDate(dueText);
      const textForNumbers = scoreText.replace(/%/g, "");
      const slash = /(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/.exec(textForNumbers);
      const score = slash ? Number(slash[1]) : parseNumber(textForNumbers);
      const pointsPossible = slash
        ? Number(slash[2])
        : parseNumber(pointsPossibleText);

      const lowerStatus = `${statusText} ${scoreText}`.toLowerCase();
      let status: Assignment["status"] = "unknown";
      if (
        /\bmissing\b/i.test(lowerStatus) ||
        /^\s*m\s*$/i.test(statusText) ||
        /^\s*m\s*$/i.test(scoreText)
      ) {
        status = "missing";
      } else if (
        /\bexempt\b/i.test(lowerStatus) ||
        /^\s*x\s*$/i.test(statusText) ||
        /^\s*x\s*$/i.test(scoreText)
      ) {
        status = "exempt";
      }
      else if (/\blate\b|\btardy\b/i.test(lowerStatus)) status = "late";
      else if (score !== null) status = "graded";
      else if (!scoreText || /^[-–—]+$/.test(scoreText) || /not graded/i.test(lowerStatus)) {
        status = "not_graded";
      }

      const isExtraCredit = /extra credit|\bEC\b|\(EC\)/i.test(assignmentName);
      const resolvedScore = status === "missing" ? 0 : score;
      const percent =
        status === "missing"
          ? 0
          : resolvedScore !== null && pointsPossible !== null && pointsPossible > 0
            ? clampPercent((resolvedScore / pointsPossible) * 100)
            : parsePercent(scoreText);

      const categoryId = categoryIdByName.get(categoryName) ?? null;

      assignments.push({
        id: stableId("asg", `${courseId}|${assignmentName}|${dueText}|${positionIndex}`),
        courseId,
        categoryId,
        name: assignmentName,
        dueDate,
        assignedDate: null,
        score: resolvedScore,
        pointsPossible,
        percent,
        status,
        isExtraCredit,
        comment: null,
        position: positionIndex,
      });
      positionIndex += 1;
    }
  } else {
    warnings.push({
      code: "assignments_missing",
      message: `No assignment table was found for ${name}.`,
      path: "courses.assignments",
    });
  }

  for (const assignment of assignments) {
    if (!assignment.categoryId) continue;
    const category = categories.find((candidate) => candidate.id === assignment.categoryId);
    if (category) category.assignmentIds.push(assignment.id);
  }

  const candidate = {
    id: courseId,
    markingPeriodId,
    name,
    shortName: name.length <= 80 ? name : null,
    teacher,
    period,
    room,
    level: courseLevelFromName(name),
    credits: null,
    grade,
    classAverage: null,
    position,
    categories,
    assignments,
  };

  const parsed = CourseSchema.safeParse(candidate);
  if (!parsed.success) {
    warnings.push({
      code: "course_validation_failed",
      message: `A course could not be read cleanly: ${name}.`,
      path: "courses",
    });
    return { course: null, warnings };
  }

  return { course: parsed.data, warnings };
}

export function parseSchedule(
  html: string,
  pageUrl: URL,
  markingPeriodId: string,
  profile: DistrictProfile,
): ParseScheduleResult {
  const $ = cheerio.load(html);
  const warnings: Warning[] = [];
  const courses: Course[] = [];
  const seen = new Set<string>();

  const marking = parseMarkingPeriods(html, profile);
  warnings.push(...marking.warnings);

  $(profile.selectors.assignment).each((index, element) => {
    const $course = $(element);
    const href = findCourseHref($, $course, pageUrl);
    const rawTitle = firstText($, $course, profile.selectors.courseTitle);
    // Course title links often point at the same page (or just "#").
    // Include the title so distinct courses are not collapsed by a shared href.
    const identity = `${href?.toString() ?? ""}|${rawTitle || index}`;
    const courseId = stableId("course", identity);
    if (seen.has(courseId)) return;
    seen.add(courseId);

    const parsed = parseCourse(
      $,
      $course,
      courseId,
      markingPeriodId,
      courses.length,
      profile,
    );
    warnings.push(...parsed.warnings);
    if (parsed.course) courses.push(parsed.course);
  });

  if (courses.length === 0) {
    const periodSelectorWorked = marking.markingPeriods.length > 0 &&
      !marking.warnings.some(
        (warning) => warning.code === "marking_period_select_missing",
      );
    warnings.push({
      code: "courses_missing",
      message: periodSelectorWorked
        ? "HAC returned no courses for this marking period."
        : "No course cards were found on the schedule page. The district profile selectors may need updating.",
      path: "courses",
    });
  }

  return {
    courses,
    markingPeriods: marking.markingPeriods,
    warnings,
  };
}

export interface ClassScheduleEntry {
  code: string;
  name: string;
  period: string;
  teacher: string | null;
  room: string | null;
  days: string | null;
  markingPeriods: string | null;
  building: string | null;
  status: string | null;
}

/** Read the rows of HAC's Classes.aspx schedule table. */
export function parseClassScheduleTable(html: string): ClassScheduleEntry[] {
  const $ = cheerio.load(html);
  const entries: ClassScheduleEntry[] = [];
  const seen = new Set<string>();

  $("table#plnMain_dgSchedule tr").each((_index, row) => {
    const cells = $(row)
      .children("td")
      .toArray()
      .map((cell) => cleanText($(cell).text()));
    if (cells.length < 4) return;

    const [code = "", name = "", period = "", teacher = "", room = ""] = cells;
    if (!/^[A-Z0-9]+\s*-\s*\d+$/i.test(code) || !name || !period) return;

    const key = `${code.toUpperCase()}|${period}|${teacher.toUpperCase()}`;
    if (seen.has(key)) return;
    seen.add(key);

    entries.push({
      code,
      name,
      period,
      teacher: teacher || null,
      room: room || null,
      days: cells[5] || null,
      markingPeriods: cells[6] || null,
      building: cells[7] || null,
      status: cells[8] || null,
    });
  });

  return entries;
}

function normalizedCourseCode(value: string): string | null {
  const match = /^\s*([A-Z0-9]+)\s*-\s*(\d+)\b/i.exec(value);
  return match ? `${match[1]!.toUpperCase()}-${match[2]!}` : null;
}

/** Add period, teacher and room from Classes.aspx to Classwork courses. */
export function mergeClassSchedule(
  courses: Course[],
  entries: ClassScheduleEntry[],
): Course[] {
  if (entries.length === 0) return courses;

  const byCode = new Map<string, ClassScheduleEntry>();
  for (const entry of entries) {
    const code = normalizedCourseCode(entry.code);
    if (code) byCode.set(code, entry);
  }

  return courses.map((course) => {
    const code = normalizedCourseCode(course.name);
    const title = code
      ? course.name.replace(/^\s*[A-Z0-9]+\s*-\s*\d+\s*/i, "").toUpperCase()
      : course.name.toUpperCase();
    const entry =
      (code ? byCode.get(code) : undefined) ??
      entries.find((candidate) => title.startsWith(candidate.name.toUpperCase()));

    if (!entry) return course;

    return {
      ...course,
      teacher: entry.teacher
        ? {
            name: entry.teacher,
            email: null,
            phone: null,
            room: entry.room,
          }
        : course.teacher,
      period: entry.period || course.period,
      room: entry.room || course.room,
    };
  });
}

export interface ParseAttendanceResult {
  days: AttendanceDay[];
  warnings: Warning[];
}

function parseCalendarAttendance(
  $: cheerio.CheerioAPI,
  profile: DistrictProfile,
): ParseAttendanceResult {
  const warnings: Warning[] = [];
  const days: AttendanceDay[] = [];
  const table = $(profile.selectors.attendanceTable).first();

  if (table.length === 0) {
    warnings.push({
      code: "attendance_missing",
      message: "No attendance table was found.",
      path: "attendance",
    });
    return { days, warnings };
  }

  const headerText =
    cleanText(table.find("table.sg-asp-calendar-header, caption").first().text()) ||
    cleanText(table.find("tr").first().text());
  const monthMatch = /([A-Za-z]{3,9})\s+(\d{4})/.exec(headerText);
  if (!monthMatch) {
    warnings.push({
      code: "attendance_empty",
      message: "The attendance calendar did not expose a readable month.",
      path: "attendance",
    });
    return { days, warnings };
  }

  const monthStart = new Date(
    `${monthMatch[1]} 1, ${monthMatch[2]} 00:00:00 UTC`,
  );
  if (Number.isNaN(monthStart.getTime())) {
    warnings.push({
      code: "attendance_empty",
      message: "The attendance calendar did not expose a readable month.",
      path: "attendance",
    });
    return { days, warnings };
  }

  const year = monthStart.getUTCFullYear();
  const monthIndex = monthStart.getUTCMonth();
  const seen = new Set<string>();

  table.find("td").each((_index, cell) => {
    const $cell = $(cell);
    const text = cleanText($cell.text());
    const dayMatch = /^(\d{1,2})(?:\s|$)/.exec(text);
    if (!dayMatch) return;

    const dayNumber = Number(dayMatch[1]);
    if (dayNumber < 1 || dayNumber > 31) return;

    const statusText = cleanText(text.slice(dayMatch[0].length));
    const markers = cleanText(
      [
        statusText,
        $cell.attr("class"),
        $cell.attr("title"),
        $cell.attr("data-status"),
        $cell
          .find("img")
          .map((_imageIndex, image) =>
            [$(image).attr("alt"), $(image).attr("title"), $(image).attr("src")]
              .filter(Boolean)
              .join(" "),
          )
          .get()
          .join(" "),
      ]
        .filter(Boolean)
        .join(" "),
    ).toLowerCase();

    const status: AttendanceDay["status"] = /absent/.test(markers)
      ? "absent"
      : /tard/.test(markers)
        ? "tardy"
        : /excused/.test(markers)
          ? "excused"
          : /remote/.test(markers)
            ? "remote"
            : /no school|holiday/.test(markers)
              ? "no_school"
              : /present/.test(markers)
                ? "present"
                : "unknown";

    // An unmarked weekday is not necessarily present (it can be a holiday),
    // so only emit days that carry an explicit attendance marker.
    if (status === "unknown" && !statusText) return;

    const date = new Date(Date.UTC(year, monthIndex, dayNumber))
      .toISOString()
      .slice(0, 10);
    if (seen.has(date)) return;
    seen.add(date);

    const candidate = {
      date,
      status,
      code: statusText || null,
      reason: null,
      note: null,
      periods: [],
    };
    const parsed = AttendanceDaySchema.safeParse(candidate);
    if (parsed.success) days.push(parsed.data);
  });

  if (days.length === 0) {
    warnings.push({
      code: "attendance_empty",
      message: "The attendance calendar had no marked days.",
      path: "attendance",
    });
  }

  return { days, warnings };
}

export function parseAttendance(
  html: string,
  profile: DistrictProfile,
): ParseAttendanceResult {
  const $ = cheerio.load(html);
  const warnings: Warning[] = [];
  const days: AttendanceDay[] = [];

  if (profile.quirks.attendanceCalendar) {
    return parseCalendarAttendance($, profile);
  }

  const table = $(profile.selectors.attendanceTable).first();
  if (table.length === 0) {
    warnings.push({
      code: "attendance_missing",
      message: "No attendance table was found.",
      path: "attendance",
    });
    return { days, warnings };
  }

  const rows = table.find(profile.selectors.attendanceRow).toArray();
  for (const row of rows) {
    const $row = $(row);
    const dateText = cleanText($row.find(profile.selectors.attendanceDate).first().text());
    const date = parseDate(dateText);
    if (!date) continue;
    const statusText = cleanText(
      $row.find(profile.selectors.attendanceStatus).first().text(),
    );
    const normalized = statusText.toLowerCase();
    const status: AttendanceDay["status"] = normalized.includes("absent")
      ? "absent"
      : normalized.includes("tard")
        ? "tardy"
        : normalized.includes("excused")
          ? "excused"
          : normalized.includes("remote")
            ? "remote"
            : normalized.includes("no school")
              ? "no_school"
              : normalized.includes("present")
                ? "present"
                : "unknown";

    const candidate = {
      date,
      status,
      code: statusText || null,
      reason: null,
      note: null,
      periods: [],
    };
    const parsed = AttendanceDaySchema.safeParse(candidate);
    if (parsed.success) days.push(parsed.data);
  }

  if (days.length === 0) {
    warnings.push({
      code: "attendance_empty",
      message: "The attendance table did not contain any readable dates.",
      path: "attendance",
    });
  }

  return { days, warnings };
}

function parseGroupedTranscript($: cheerio.CheerioAPI): {
  transcript: Transcript;
  warnings: Warning[];
} {
  const warnings: Warning[] = [];
  const entries: Transcript["entries"] = [];
  const seen = new Set<string>();
  let currentYear = "";

  $("table").each((_index, table) => {
    const $table = $(table);
    const tableText = cleanText($table.text());
    const yearMatch = /Year:\s*(\d{4}\s*[-–]\s*\d{2,4})/i.exec(tableText);
    if (yearMatch?.[1]) currentYear = yearMatch[1].replace(/\s+/g, "");

    const id = $table.attr("id") ?? "";
    if (!/dgCourses/i.test(id) || !currentYear) return;

    $table.find("tr").each((_rowIndex, row) => {
      const $row = $(row);
      const cells = $row.find("td").toArray();
      if (cells.length < 6) return;

      const code = cleanText($(cells[0]).text());
      const name = cleanText($(cells[1]).text()) || code;
      if (!name || /^course$/i.test(code) || /^description$/i.test(name)) return;

      const sem1 = cleanText($(cells[2]).text());
      const sem2 = cleanText($(cells[3]).text());
      const final = cleanText($(cells[4]).text());
      const gradeText = final || sem2 || sem1;
      const term = final
        ? "Full year"
        : sem2
          ? "Semester 2"
          : sem1
            ? "Semester 1"
            : null;
      const key = `${currentYear}|${name}|${term ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);

      entries.push({
        courseName: name,
        courseId: code || null,
        schoolYear: currentYear,
        term,
        grade: parseGrade(gradeText),
        credits: parseNumber(cleanText($(cells[5]).text())),
        level: courseLevelFromName(name),
        includedInGpa: true,
      });
    });
  });

  const bodyText = cleanText($("body").text());
  const weightedMatch = /weighted\s*(?:gpa)?\s*:?\s*(\d+(?:\.\d+)?)/i.exec(
    bodyText,
  );
  const unweightedMatch =
    /unweighted\s*(?:gpa)?\s*:?\s*(\d+(?:\.\d+)?)/i.exec(bodyText);
  const rankMatch = /(?:class\s+)?rank\s*:?\s*(\d+)\s*(?:of|\/)\s*(\d+)/i.exec(
    bodyText,
  );
  const creditsEarned = entries.reduce(
    (sum, entry) => sum + (entry.credits ?? 0),
    0,
  );

  const transcript: Transcript = {
    gpa: {
      weighted: weightedMatch ? Number(weightedMatch[1]) : null,
      unweighted: unweightedMatch ? Number(unweightedMatch[1]) : null,
    },
    rank:
      rankMatch && Number(rankMatch[1]) > 0 && Number(rankMatch[2]) > 0
        ? { position: Number(rankMatch[1]), outOf: Number(rankMatch[2]) }
        : null,
    creditsEarned: entries.length
      ? Math.round(creditsEarned * 10000) / 10000
      : null,
    entries,
  };

  if (entries.length === 0) {
    warnings.push({
      code: "transcript_empty",
      message: "No transcript rows were found.",
      path: "transcript",
    });
  }

  const parsed = TranscriptSchema.safeParse(transcript);
  if (!parsed.success) {
    warnings.push({
      code: "transcript_validation_failed",
      message: "The transcript did not match Tesseract's data contract.",
      path: "transcript",
    });
    return {
      transcript: {
        gpa: { weighted: null, unweighted: null },
        rank: null,
        creditsEarned: null,
        entries: [],
      },
      warnings,
    };
  }

  return { transcript: parsed.data, warnings };
}

export function parseTranscript(html: string, profile: DistrictProfile): {
  transcript: Transcript;
  warnings: Warning[];
} {
  const $ = cheerio.load(html);
  if (profile.quirks.transcriptGroupedByYear) {
    return parseGroupedTranscript($);
  }
  const warnings: Warning[] = [];
  const entries: Transcript["entries"] = [];

  $(profile.selectors.transcriptRow).each((_index, row) => {
    const $row = $(row);
    const courseName = cleanText(
      $row.find(profile.selectors.transcriptCourse).first().text(),
    );
    const year = cleanText($row.find(profile.selectors.transcriptYear).first().text());
    if (!courseName || !year || /^course$/i.test(courseName)) return;

    entries.push({
      courseName,
      courseId: null,
      schoolYear: year,
      term: cleanText($row.find(profile.selectors.transcriptTerm).first().text()) || null,
      grade: parseGrade(
        $row.find(profile.selectors.transcriptGrade).first().text(),
      ),
      credits: parseNumber(
        $row.find(profile.selectors.transcriptCredits).first().text(),
      ),
      level: courseLevelFromName(courseName),
      includedInGpa: true,
    });
  });

  const gpaText = cleanText($(profile.selectors.transcriptGpa).first().text());
  const rankText = cleanText($(profile.selectors.transcriptRank).first().text());
  const rankMatch = /(\d+)\s*(?:of|\/)\s*(\d+)/i.exec(rankText);
  const weightedMatch = /weighted\s*:?\s*(\d+(?:\.\d+)?)/i.exec(gpaText);
  const unweightedMatch = /unweighted\s*:?\s*(\d+(?:\.\d+)?)/i.exec(gpaText);

  const transcript: Transcript = {
    gpa: {
      weighted: weightedMatch ? Number(weightedMatch[1]) : null,
      unweighted: unweightedMatch
        ? Number(unweightedMatch[1])
        : parseNumber(gpaText),
    },
    rank:
      rankMatch && Number(rankMatch[1]) > 0 && Number(rankMatch[2]) > 0
        ? { position: Number(rankMatch[1]), outOf: Number(rankMatch[2]) }
        : null,
    creditsEarned: null,
    entries,
  };

  if (entries.length === 0) {
    warnings.push({
      code: "transcript_empty",
      message: "No transcript rows were found.",
      path: "transcript",
    });
  }

  const parsed = TranscriptSchema.safeParse(transcript);
  if (!parsed.success) {
    warnings.push({
      code: "transcript_validation_failed",
      message: "The transcript did not match Tesseract's data contract.",
      path: "transcript",
    });
    return {
      transcript: {
        gpa: { weighted: null, unweighted: null },
        rank: null,
        creditsEarned: null,
        entries: [],
      },
      warnings,
    };
  }

  return { transcript: parsed.data, warnings };
}

export function parseReportCards(
  html: string,
  profile: DistrictProfile,
): { reports: ReportCard[]; warnings: Warning[] } {
  const $ = cheerio.load(html);
  const warnings: Warning[] = [];
  const reports: ReportCard[] = [];

  const tables = $(profile.selectors.reportTable).toArray();
  for (const table of tables) {
    const $table = $(table);
    const entries: ReportCard["entries"] = [];
    $table.find(profile.selectors.reportRow).each((_index, row) => {
      const $row = $(row);
      const cells = $row.find("td").toArray();
      if (cells.length < 2) return;
      const courseName =
        cleanText($row.find(profile.selectors.reportCourse).first().text()) ||
        cleanText($(cells[0]).text());
      const gradeText =
        cleanText($row.find(profile.selectors.reportGrade).first().text()) ||
        cleanText($(cells[1]).text());
      if (
        !courseName ||
        /^course$/i.test(courseName) ||
        /^description$/i.test(courseName)
      ) {
        return;
      }
      entries.push({
        courseId: null,
        courseName,
        teacherName: null,
        grade: parseGrade(gradeText),
        credits: parseNumber(
          $row.find(profile.selectors.reportCredits).first().text(),
        ),
        comment: null,
      });
    });

    if (entries.length === 0) continue;

    // HAC often emits a second, blank row for the same course (for example a
    // semester placeholder). Keep the row that actually carries a grade.
    const byCourse = new Map<string, ReportCard["entries"][number]>();
    for (const entry of entries) {
      const existing = byCourse.get(entry.courseName);
      if (
        !existing ||
        (existing.grade.percent === null && entry.grade.percent !== null)
      ) {
        byCourse.set(entry.courseName, entry);
      }
    }
    const uniqueEntries = [...byCourse.values()];

    const title = cleanText($table.find("caption, th").first().text()) || "Report card";
    const candidate = {
      id: stableId("report", `${title}|${uniqueEntries[0]?.courseName ?? ""}`),
      kind: "report_card" as const,
      title,
      markingPeriodId: null,
      schoolYear: null,
      issuedDate: null,
      entries: uniqueEntries,
      gpa: null,
      absences: null,
      tardies: null,
    };
    const parsed = ReportCardSchema.safeParse(candidate);
    if (parsed.success) reports.push(parsed.data);
  }

  if (reports.length === 0) {
    warnings.push({
      code: "reports_missing",
      message: "No report cards were found on the HAC page.",
      path: "reports",
    });
  }

  return { reports, warnings };
}
