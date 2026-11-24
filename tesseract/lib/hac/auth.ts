import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import {
  StudentSchema,
  type District,
  type Student,
  type Warning,
} from "@/lib/types";
import {
  InvalidCredentialsProblem,
  InvalidInputProblem,
  ParseProblem,
  UpstreamProblem,
} from "@/lib/security/errors";
import { CookieJar } from "./cookies";
import { clearCredentialFields, extractForm } from "./html-form";
import { fetchHacPage } from "./http";
import { parseDistrictDirectory } from "./districts";
import { profileForDistrictUrl, type DistrictProfile } from "./profiles";
import { joinHacPath, normalizeDistrictUrl } from "./url";
import type { StoredCookie } from "@/lib/session/schema";

export interface AuthenticatedLogin {
  status: "authenticated";
  student: Student;
  students: Student[];
  district: District;
  cookies: StoredCookie[];
  warnings: Warning[];
}

export interface MfaLogin {
  status: "mfa_required";
  warnings: Warning[];
}

export type HacLoginResult = AuthenticatedLogin | MfaLogin;

export interface HacLoginInput {
  districtUrl: string;
  username: string;
  password: string;
  campusId?: string;
  districtId?: string;
}

export interface StudentChoice {
  student: Student;
  rowValue: string | null;
  href: string | null;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha256").update(value).digest("base64url").slice(0, 18)}`;
}

function cleanText(value: string | undefined | null): string {
  return (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max).trim() : value;
}

function hostLabel(hostname: string): string {
  return truncate(hostname.replace(/^www\./, ""), 120) || "Home Access Center";
}

function districtFor(
  baseUrl: string,
  profile: DistrictProfile,
  name?: string,
  districtId?: string,
): District {
  const url = new URL(baseUrl);
  const identity = districtId
    ? `${url.hostname}:${districtId}`
    : url.hostname;
  return {
    id: stableId("dist", identity),
    name: truncate(cleanText(name) || hostLabel(url.hostname), 120),
    baseUrl,
    profileId: profile.id,
  };
}

function pageText(html: string): string {
  return cleanText(cheerio.load(html).text());
}

function pageHasPasswordField(html: string): boolean {
  return cheerio.load(html)('input[type="password"]').length > 0;
}

function pageHasMarker(html: string, markers: readonly string[]): boolean {
  const text = pageText(html).toLowerCase();
  return markers.some((marker) => text.includes(marker.toLowerCase()));
}

function isMfaPage(html: string, profile: DistrictProfile): boolean {
  return pageHasMarker(html, profile.quirks.mfaMarkers) && !pageHasPasswordField(html);
}

/** A password field is the one reliable cross-district login-page signal. */
export function isLoginPage(html: string): boolean {
  return pageHasPasswordField(html);
}

function escapeCssValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function extractLoginFields(
  html: string,
  loginUrl: URL,
  profile: DistrictProfile,
): {
  action: URL;
  fields: Record<string, string>;
  usernameField: string;
  passwordField: string;
} {
  const $ = cheerio.load(html);
  const formSelector =
    profile.quirks.loginFormSelector === "form"
      ? 'form:has(input[type="password"])'
      : profile.quirks.loginFormSelector;

  const form = extractForm(html, {
    pageUrl: loginUrl,
    formSelector,
    fallbackToFirstForm: false,
    includePasswords: false,
    submitSelector: 'input[type="submit"], button[type="submit"], button:not([type])',
  });

  if (!form || form.method !== "POST") {
    throw new ParseProblem(
      "Tesseract found a HAC login page, but its sign-in form was not a standard POST form.",
    );
  }

  // Some districts put decoy "tempPW" fields before the real password.
  // Prefer a field whose name actually looks like a password field; fall back
  // to the first password input only when no named candidate exists.
  const $passwordInputs = $('input[type="password"]');
  const $namedPassword = $passwordInputs
    .filter((_index, element) =>
      /pass(word)?|pwd/i.test($(element).attr("name") ?? ""),
    )
    .first();
  const $password =
    $namedPassword.length > 0 ? $namedPassword : $passwordInputs.first();
  const $loginForm = $password.closest("form");
  if ($password.length === 0 || $loginForm.length === 0) {
    throw new ParseProblem("Tesseract could not find the HAC password form.");
  }

  let usernameField = profile.quirks.loginUsernameField;
  let passwordField = profile.quirks.loginPasswordField;

  if (!usernameField) {
    const candidates = $loginForm
      .find('input[type="text"], input[type="email"], input:not([type])')
      .toArray();
    const named = candidates.find((element) => {
      const name = ($(element).attr("name") ?? "").toLowerCase();
      return /user|login|account|logon/.test(name);
    });
    const chosen = named ?? candidates[0];
    if (chosen) usernameField = $(chosen).attr("name") ?? null;
  }

  if (!passwordField) {
    passwordField = $password.attr("name") ?? null;
  }

  if (!usernameField || !passwordField) {
    throw new ParseProblem(
      "Tesseract could not identify the username and password fields on the HAC login page.",
    );
  }

  if (form.action.origin !== loginUrl.origin) {
    throw new ParseProblem(
      "The HAC login form submits to a different host. Tesseract will not send credentials there.",
    );
  }

  return {
    action: form.action,
    fields: clearCredentialFields(form.fields),
    usernameField,
    passwordField,
  };
}

function studentFromName(
  displayName: string,
  value: string,
  index: number,
  gradeLevel: string | null,
): Student {
  const name = truncate(cleanText(displayName) || `Student ${index + 1}`, 120);
  let firstName: string | null = null;
  let lastName: string | null = null;

  if (name.includes(",")) {
    const [last, first] = name.split(",", 2).map((part) => part.trim());
    lastName = last || null;
    firstName = first?.split(/\s+/)[0] ?? null;
  } else {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      firstName = parts[0] ?? null;
      lastName = parts[parts.length - 1] ?? null;
    }
  }

  // Prefer HAC's stable row value. The display name is only a fallback; index
  // is deliberately excluded so re-rendering the picker does not change ids.
  const identity = `${value.trim()}|${name}`;
  const candidate = {
    id: stableId("stu", identity),
    displayName: name,
    firstName,
    lastName,
    gradeLevel,
    school: null,
    homeroom: null,
    counselor: null,
  };

  const parsed = StudentSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  return {
    ...candidate,
    displayName: name.slice(0, 120),
    firstName: null,
    lastName: null,
    gradeLevel: null,
  };
}

export function parseStudentChoices(
  html: string,
  profile: DistrictProfile,
): StudentChoice[] {
  const $ = cheerio.load(html);
  const choices: StudentChoice[] = [];
  const seen = new Set<string>();

  // A dropdown is a multi-student control too, even though it does not use the
  // row markup below. Do not silently treat the selected option as the only
  // student: that could attach the wrong grades to the session.
  const unsupportedSelect = $(
    'select[name*="student" i], select[id*="student" i], select[name*="campus" i], select[id*="campus" i]',
  )
    .filter((_index, element) => $(element).find("option").length > 1)
    .first();
  if (unsupportedSelect.length > 0) {
    throw new ParseProblem(
      "HAC uses a student dropdown that this profile does not support yet. Sign in directly to the district's HAC if you need another student.",
    );
  }

  const rows = $(profile.quirks.studentPickerRowSelector).toArray();

  const add = (text: string, value: string | null, href: string | null): void => {
    const display = cleanText(text)
      .replace(/\b(select|choose)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!display || display.length > 240) return;

    const gradeMatch = /grade\s*(K|\d{1,2})/i.exec(display);
    const withoutGrade = display
      .replace(/\(?\s*grade\s*(K|\d{1,2})\s*\)?/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!withoutGrade) return;

    const key = `${value ?? href ?? ""}|${withoutGrade}`;
    if (seen.has(key)) return;
    seen.add(key);
    choices.push({
      student: studentFromName(
        withoutGrade,
        value ?? href ?? withoutGrade,
        choices.length,
        gradeMatch?.[1] ? gradeMatch[1].toUpperCase() : null,
      ),
      rowValue: value,
      href,
    });
  };

  rows.forEach((row) => {
    const $row = $(row);
    const $input = $row.find('input[type="radio"], input[type="checkbox"]').first();
    const value =
      cleanText($input.attr("value")) ||
      cleanText($row.attr("data-student-id")) ||
      null;
    const href = $row.find("a[href]").first().attr("href") ?? null;
    const text =
      cleanText($row.text()) ||
      cleanText($row.find("a").first().text()) ||
      cleanText($row.find("label").first().text());
    add(text, value, href);
  });

  return choices;
}

function chooseStudent(
  choices: StudentChoice[],
  campusId: string | undefined,
): StudentChoice | null {
  if (choices.length === 0) return null;
  if (!campusId) return choices[0] ?? null;

  const match = choices.find(
    (choice) =>
      choice.student.id === campusId ||
      choice.rowValue === campusId ||
      choice.student.displayName === campusId,
  );
  if (!match) {
    throw new InvalidInputProblem(
      "The selected student is not available in this HAC account.",
    );
  }
  return match;
}

export function findExplicitStudentName(html: string): string | null {
  const $ = cheerio.load(html);
  const selectors = [
    "#studentName",
    ".student-name",
    ".sg-student-name",
    "span.sg-mobile-student-info",
    'span[id*="StudentName"]',
    'div[id*="StudentName"]',
  ];

  for (const selector of selectors) {
    const value = cleanText($(selector).first().text());
    if (value && value.length <= 120 && !/home access center/i.test(value)) {
      return value;
    }
  }
  return null;
}

export function namesMatch(left: string, right: string): boolean {
  const normalize = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  if (a === b) return true;
  // Match whole name tokens, not arbitrary substrings: "Al" must not confirm
  // "Alfred", while "Jordan Ellis" still matches a page that adds a grade or
  // campus suffix.
  const containsName = (larger: string, smaller: string): boolean =>
    larger.startsWith(`${smaller} `) ||
    larger.endsWith(` ${smaller}`) ||
    larger.includes(` ${smaller} `);
  return containsName(a, b) || containsName(b, a);
}

function extractStudentNameFromPage(html: string): string {
  const explicit = findExplicitStudentName(html);
  if (explicit) return explicit;

  const $ = cheerio.load(html);
  const title = cleanText($("title").first().text());
  if (title) {
    const parts = title.split(/\s[-|]\s/).map((part) => part.trim());
    const candidate = parts.find(
      (part) => part && !/home access|hac|login|sign in|classes|schedule/i.test(part),
    );
    if (candidate) return truncate(candidate, 120);
  }

  return "Student";
}

function pickerRow(
  $: cheerio.CheerioAPI,
  profile: DistrictProfile,
  selected: StudentChoice,
): cheerio.Cheerio<AnyNode> {
  const $row = $(profile.quirks.studentPickerRowSelector)
    .filter((_index, element) => {
      const $candidate = $(element);
      const $input = $candidate
        .find('input[type="radio"], input[type="checkbox"]')
        .first();
      const rowValue =
        cleanText($input.attr("value")) || cleanText($candidate.attr("data-student-id"));
      const href = $candidate.find("a[href]").first().attr("href") ?? null;

      if (selected.rowValue !== null && rowValue === selected.rowValue) return true;
      if (selected.href !== null && href === selected.href) return true;
      if (selected.rowValue === null && selected.href === null) {
        return cleanText($candidate.text()).includes(selected.student.displayName);
      }
      return false;
    })
    .first();
  return $row;
}

/**
 * Select a student only through an explicit radio/checkbox form or a link.
 * Returning the original page when no control exists would make callers think
 * a switch succeeded, so unsupported pickers fail closed.
 */
export async function selectStudentIfNeeded(
  choices: StudentChoice[],
  selected: StudentChoice,
  html: string,
  pageUrl: URL,
  jar: CookieJar,
  profile: DistrictProfile,
): Promise<string> {
  if (choices.length <= 1) return html;

  const $ = cheerio.load(html);
  const $row = pickerRow($, profile, selected);
  if ($row.length === 0) {
    throw new ParseProblem("HAC did not expose the selected student in its picker.");
  }

  const $input = $row.find('input[type="radio"], input[type="checkbox"]').first();
  const inputName = cleanText($input.attr("name"));
  const formSelector =
    inputName && selected.rowValue !== null
      ? `form:has(input[name="${escapeCssValue(inputName)}"][value="${escapeCssValue(selected.rowValue)}"])`
      : `form:has(${profile.quirks.studentPickerRowSelector})`;
  const form = extractForm(html, {
    pageUrl,
    formSelector,
    fallbackToFirstForm: false,
    fieldOverrides:
      inputName && selected.rowValue !== null
        ? { [inputName]: selected.rowValue }
        : undefined,
    submitSelector: profile.quirks.studentPickerSubmitSelector,
    includePasswords: false,
  });

  const href = $row.find("a[href]").first().attr("href");

  if (form?.method === "POST" && inputName && selected.rowValue !== null) {
    if (form.action.origin !== pageUrl.origin) {
      throw new ParseProblem(
        "The student picker submits to a different host. Tesseract will not send this request.",
      );
    }
    const response = await fetchHacPage({
      url: form.action,
      jar,
      profile,
      method: "POST",
      form: form.fields,
      referer: pageUrl,
    });
    return response.html;
  }

  if (href) {
    const target = new URL(href, pageUrl);
    if (target.origin !== pageUrl.origin) {
      throw new ParseProblem("The student picker links to a different host.");
    }
    const response = await fetchHacPage({
      url: target,
      jar,
      profile,
      referer: pageUrl,
    });
    return response.html;
  }

  throw new ParseProblem("HAC did not expose a usable student selection control.");
}

async function fetchSchedulePage(
  baseUrl: string,
  jar: CookieJar,
  profile: DistrictProfile,
): Promise<{ warnings: Warning[] }> {
  const warnings: Warning[] = [];
  const scheduleUrl = joinHacPath(baseUrl, profile.paths.schedule);

  try {
    const schedule = await fetchHacPage({
      url: scheduleUrl,
      jar,
      profile,
      referer: joinHacPath(baseUrl, profile.paths.home),
    });
    if (!isLoginPage(schedule.html)) return { warnings };
  } catch (error) {
    if (!(error instanceof UpstreamProblem)) throw error;
    warnings.push({
      code: "schedule_unavailable",
      message:
        "Signed in, but the schedule page was not available at the profile's default path.",
    });
  }

  try {
    const home = await fetchHacPage({
      url: joinHacPath(baseUrl, profile.paths.home),
      jar,
      profile,
    });
    if (isLoginPage(home.html)) {
      throw new InvalidCredentialsProblem();
    }
    return { warnings };
  } catch (error) {
    if (error instanceof InvalidCredentialsProblem) throw error;
    if (error instanceof UpstreamProblem) return { warnings };
    throw error;
  }
}

export async function loginToHac(input: HacLoginInput): Promise<HacLoginResult> {
  const district = normalizeDistrictUrl(input.districtUrl);
  const profile = profileForDistrictUrl(district.baseUrl);
  const jar = new CookieJar();

  const loginPage = await fetchHacPage({
    url: joinHacPath(district.baseUrl, profile.paths.login),
    jar,
    profile,
  });

  if (isMfaPage(loginPage.html, profile)) {
    return { status: "mfa_required", warnings: [] };
  }

  const form = extractLoginFields(loginPage.html, loginPage.finalUrl, profile);
  let selectedDistrictName: string | undefined;

  if (input.districtId) {
    const directory = parseDistrictDirectory(loginPage.html);
    if (!directory) {
      throw new InvalidInputProblem(
        "This HAC address did not show a district picker. Sign in with the default district or paste your district's own HAC address.",
      );
    }
    const option = directory.options.find(
      (candidate) => candidate.id === input.districtId,
    );
    if (!option) {
      throw new InvalidInputProblem(
        "That district is no longer available on this HAC page. Reload the district list and try again.",
      );
    }
    form.fields[directory.field] = option.id;
    selectedDistrictName = option.name;
  }

  const submitted = await fetchHacPage({
    url: form.action,
    jar,
    profile,
    method: "POST",
    form: {
      ...form.fields,
      [form.usernameField]: input.username,
      [form.passwordField]: input.password,
    },
    referer: loginPage.finalUrl,
  });

  if (isMfaPage(submitted.html, profile)) {
    return { status: "mfa_required", warnings: [] };
  }

  if (
    pageHasMarker(submitted.html, profile.quirks.invalidLoginMarkers) ||
    isLoginPage(submitted.html)
  ) {
    throw new InvalidCredentialsProblem();
  }

  const choices = parseStudentChoices(submitted.html, profile);
  const selected = chooseStudent(choices, input.campusId);
  const identityHtml = submitted.html;

  if (selected && choices.length > 1) {
    const selectedHtml = await selectStudentIfNeeded(
      choices,
      selected,
      submitted.html,
      submitted.finalUrl,
      jar,
      profile,
    );
    if (isLoginPage(selectedHtml)) throw new InvalidCredentialsProblem();

    const confirmed = findExplicitStudentName(selectedHtml);
    if (!confirmed || !namesMatch(confirmed, selected.student.displayName)) {
      throw new ParseProblem(
        "HAC did not confirm the selected student. Sign in again or use the district's student picker.",
      );
    }
  }

  const schedule = await fetchSchedulePage(district.baseUrl, jar, profile);
  const warnings = [...schedule.warnings];

  const students =
    choices.length > 0
      ? choices.map((choice) => choice.student)
      : [
          studentFromName(
            extractStudentNameFromPage(identityHtml),
            district.baseUrl,
            0,
            null,
          ),
        ];

  const activeIndex = selected
    ? Math.max(
        0,
        choices.findIndex((choice) => choice.student.id === selected.student.id),
      )
    : 0;
  const student =
    students[activeIndex] ??
    students[0] ??
    studentFromName("Student", district.baseUrl, 0, null);

  return {
    status: "authenticated",
    student,
    students,
    district: districtFor(
      district.baseUrl,
      profile,
      selectedDistrictName,
      input.districtId,
    ),
    cookies: jar.toJson(),
    warnings,
  };
}
