"use client";

import type {
  AssignmentWithCourse,
  CourseLevel,
  CourseSummary,
  MeData,
} from "@/lib/types";

export type ThemeChoice = "system" | "light" | "dark";

export interface GradeThresholds {
  a: number;
  b: number;
  c: number;
  d: number;
}

export interface AppSettings {
  theme: ThemeChoice;
  accent: string;
  glassIntensity: number;
  reduceMotion: boolean;
  colorCode: boolean;
  thresholds: GradeThresholds;
  gpaScale: 4 | 5;
  weightedGpa: boolean;
  levelWeights: Record<CourseLevel, number>;
}

export interface CoursePrefs {
  order: string[];
  hidden: string[];
}

export interface LastData {
  me: MeData;
  courses: CourseSummary[];
  upcoming: AssignmentWithCourse[];
  fetchedAt: string;
}

const SETTINGS_KEY = "tesseract.settings.v1";
const DISTRICTS_KEY = "tesseract.districts.v2";
const LEGACY_DISTRICTS_KEY = "tesseract.districts.v1";
const PREFS_KEY = "tesseract.course-prefs.v1";
const LAST_DATA_KEY = "tesseract.last-data.v1";

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  accent: "#df7257",
  glassIntensity: 100,
  reduceMotion: false,
  colorCode: true,
  thresholds: { a: 90, b: 80, c: 70, d: 60 },
  gpaScale: 4,
  weightedGpa: true,
  levelWeights: {
    regular: 0,
    honors: 0.5,
    ap: 1,
    ib: 1,
    dual_enrollment: 0.5,
    other: 0,
    unknown: 0,
  },
};

function canStore(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string): T | null {
  if (!canStore()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked; the app must still work in memory.
  }
}

export function loadSettings(): AppSettings {
  const stored = readJson<Partial<AppSettings>>(SETTINGS_KEY);
  if (!stored) return { ...DEFAULT_SETTINGS, thresholds: { ...DEFAULT_SETTINGS.thresholds }, levelWeights: { ...DEFAULT_SETTINGS.levelWeights } };

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    thresholds: { ...DEFAULT_SETTINGS.thresholds, ...(stored.thresholds ?? {}) },
    levelWeights: { ...DEFAULT_SETTINGS.levelWeights, ...(stored.levelWeights ?? {}) },
  };
}

export function saveSettings(settings: AppSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export interface SavedDistrict {
  url: string;
  districtId?: string;
  districtName?: string;
}

function toSavedDistrict(value: unknown): SavedDistrict | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SavedDistrict>;
  if (typeof candidate.url !== "string") return null;
  const url = candidate.url.trim().replace(/\/+$/, "");
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    url,
    ...(typeof candidate.districtId === "string" && candidate.districtId.trim()
      ? { districtId: candidate.districtId.trim().slice(0, 128) }
      : {}),
    ...(typeof candidate.districtName === "string" && candidate.districtName.trim()
      ? { districtName: candidate.districtName.trim().slice(0, 120) }
      : {}),
  };
}

export function loadSavedDistricts(): SavedDistrict[] {
  const stored = readJson<unknown>(DISTRICTS_KEY);
  if (Array.isArray(stored)) {
    return stored
      .map(toSavedDistrict)
      .filter((value): value is SavedDistrict => value !== null)
      .slice(0, 12);
  }

  // Preserve districts saved before shared-network support was added.
  const legacy = readJson<unknown>(LEGACY_DISTRICTS_KEY);
  if (!Array.isArray(legacy)) return [];
  return legacy
    .filter((value): value is string => typeof value === "string")
    .map((url) => toSavedDistrict({ url }))
    .filter((value): value is SavedDistrict => value !== null)
    .slice(0, 12);
}

export function rememberDistrict(entry: SavedDistrict): SavedDistrict[] {
  const normalized = toSavedDistrict(entry);
  if (!normalized) return loadSavedDistricts();

  const next = [
    normalized,
    ...loadSavedDistricts().filter(
      (value) =>
        !(
          value.url === normalized.url &&
          value.districtId === normalized.districtId
        ),
    ),
  ].slice(0, 12);
  writeJson(DISTRICTS_KEY, next);
  return next;
}

export function forgetDistrict(url: string, districtId?: string): SavedDistrict[] {
  const next = loadSavedDistricts().filter(
    (value) => !(value.url === url && value.districtId === districtId),
  );
  writeJson(DISTRICTS_KEY, next);
  return next;
}

export function prefsKey(studentId: string, markingPeriodId: string | null): string {
  return `${PREFS_KEY}:${studentId}:${markingPeriodId ?? "current"}`;
}

export function loadCoursePrefs(
  studentId: string,
  markingPeriodId: string | null,
): CoursePrefs {
  const stored = readJson<CoursePrefs>(prefsKey(studentId, markingPeriodId));
  return {
    order: Array.isArray(stored?.order) ? stored.order : [],
    hidden: Array.isArray(stored?.hidden) ? stored.hidden : [],
  };
}

export function saveCoursePrefs(
  studentId: string,
  markingPeriodId: string | null,
  prefs: CoursePrefs,
): void {
  writeJson(prefsKey(studentId, markingPeriodId), prefs);
}

export function saveLastData(data: LastData): void {
  writeJson(LAST_DATA_KEY, data);
}

export function loadLastData(): LastData | null {
  const stored = readJson<LastData>(LAST_DATA_KEY);
  if (!stored?.me || !Array.isArray(stored.courses)) return null;
  return stored;
}

export function clearLastData(): void {
  if (!canStore()) return;
  try {
    window.localStorage.removeItem(LAST_DATA_KEY);
  } catch {
    // ignore
  }
}

export function clearLocalSettings(): void {
  if (!canStore()) return;
  for (const key of [SETTINGS_KEY, DISTRICTS_KEY, PREFS_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export async function exportLocalData(): Promise<string> {
  const { listAllSnapshots } = await import("./snapshots");
  const snapshots = await listAllSnapshots();
  return JSON.stringify(
    {
      app: "Tesseract",
      exportedAt: new Date().toISOString(),
      settings: loadSettings(),
      savedDistricts: loadSavedDistricts(),
      snapshots,
    },
    null,
    2,
  );
}

/** Remove everything this app keeps in the browser. Never touches the HAC session cookie. */
export async function clearAllLocalData(): Promise<void> {
  if (!canStore()) return;
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith("tesseract.")) keys.push(key);
  }
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  const { deleteLocalDatabase } = await import("./snapshots");
  await deleteLocalDatabase();

  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  }
}
