"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LogoMark } from "@/components/brand/logo-mark";
import { Glass } from "@/components/glass/glass";
import { SITE } from "@/lib/config/site";
import type {
  AssignmentWithCourse,
  Course,
  CourseSummary,
  MeData,
  Snapshot,
  Warning,
} from "@/lib/types";
import { apiGet, errorMessage, SessionLostError } from "@/components/workspace/api";
import { initials } from "@/components/workspace/format";
import { averagePercent, calculateGpa } from "@/lib/client/grades";
import {
  buildSnapshot,
  listSnapshots,
  saveSnapshot,
  seedDemoSnapshots,
} from "@/lib/client/snapshots";
import {
  DEFAULT_SETTINGS,
  loadLastData,
  loadSettings,
  saveLastData,
  saveSettings,
  type AppSettings,
} from "@/lib/client/storage";
import { diffSnapshots } from "@/lib/client/insights";
import { CourseSheet } from "./course-sheet";
import { GradesScreen } from "./grades-screen";
import { HomeScreen } from "./home-screen";
import { InsightsScreen } from "./insights-screen";
import { MoreScreen } from "./more-screen";
import { ToolsScreen } from "./tools-screen";
import styles from "./app.module.css";

export type View = "home" | "grades" | "insights" | "tools" | "more";

const NAV: ReadonlyArray<{ id: View; label: string; index: string }> = [
  { id: "home", label: "Home", index: "01" },
  { id: "grades", label: "Grades", index: "02" },
  { id: "insights", label: "Insights", index: "03" },
  { id: "tools", label: "Tools", index: "04" },
  { id: "more", label: "More", index: "05" },
];

interface BootstrapPayload {
  me: MeData;
  courses: CourseSummary[];
  upcoming: AssignmentWithCourse[];
}

const VIEW_META: Record<View, { eyebrow: string; title: string }> = {
  home: { eyebrow: "Today", title: "Home" },
  grades: { eyebrow: "Marking period", title: "Grades" },
  insights: { eyebrow: "Local history", title: "Insights" },
  tools: { eyebrow: "Plan, don't guess", title: "Tools" },
  more: { eyebrow: "Records & settings", title: "More" },
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Workspace({
  initialDistrictId,
  initialStudentId,
}: {
  initialDistrictId: string;
  initialStudentId: string;
}) {
  const router = useRouter();
  const [me, setMe] = useState<MeData | null>(null);
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [upcoming, setUpcoming] = useState<AssignmentWithCourse[] | null>(null);
  const [details, setDetails] = useState<Record<string, Course>>({});
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [markingPeriod, setMarkingPeriod] = useState<string | null>(null);
  const [view, setView] = useState<View>("home");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [offline, setOffline] = useState(false);
  const [online, setOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [systemDark, setSystemDark] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const toastTimer = useRef<number | null>(null);
  const requestedDetails = useRef(new Set<string>());
  const snapshotSignature = useRef("");
  const periodSequence = useRef(0);
  const markingPeriodRef = useRef<string | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

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

  const handleSessionLost = useCallback(() => {
    router.replace("/?expired=1");
    router.refresh();
  }, [router]);

  const handleDetailLoaded = useCallback((course: Course) => {
    setDetails((previous) => ({ ...previous, [course.id]: course }));
  }, []);

  const closeCourse = useCallback(() => setSelectedCourseId(null), []);

  const handleFailure = useCallback(
    (problem: unknown) => {
      if (problem instanceof SessionLostError) {
        handleSessionLost();
        return;
      }
      setError(errorMessage(problem));
    },
    [handleSessionLost],
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const frame = requestAnimationFrame(() => {
      setSettings(loadSettings());
      setSettingsReady(true);
      setSystemDark(query.matches);
    });
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => {
      cancelAnimationFrame(frame);
      query.removeEventListener("change", onChange);
    };
  }, []);

  const resolvedTheme =
    settings.theme === "system" ? (systemDark ? "dark" : "light") : settings.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.reduceMotion = String(settings.reduceMotion);
    root.style.setProperty("--accent", settings.accent);
    const intensity = Math.max(0, Math.min(100, settings.glassIntensity)) / 100;
    root.style.setProperty("--glass-tint", (0.08 * intensity).toFixed(3));
    root.style.setProperty("--glass-rim", (0.6 * (0.5 + 0.5 * intensity)).toFixed(3));
    root.style.setProperty("--glass-blur", `${Math.round(14 * intensity)}px`);
    root.style.setProperty(
      "--glass-blur-fallback",
      `${Math.round(14 * Math.max(0.55, intensity))}px`,
    );
    root.style.setProperty("--glass-refraction", String(Math.round(48 * intensity)));
    root.style.setProperty("--glass-chroma", (0.5 * intensity).toFixed(2));
    window.dispatchEvent(new Event("tesseract:glass"));
    if (settingsReady) saveSettings(settings);
  }, [settings, resolvedTheme, settingsReady]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setRefreshing(true);
      setError(null);

      // Paint the last saved record immediately while the fresh copy loads.
      const lastData = loadLastData();
      if (
        lastData &&
        lastData.me.district.id === initialDistrictId &&
        lastData.me.student.id === initialStudentId
      ) {
        setMe((current) => current ?? lastData.me);
        setCourses((current) => current ?? lastData.courses);
        setUpcoming((current) => current ?? lastData.upcoming);
        setMarkingPeriod(
          (current) => current ?? lastData.me.activeMarkingPeriodId,
        );
        setLastUpdated((current) => current ?? lastData.fetchedAt);
        setBooted(true);
      }

      try {
        const selectedPeriod = markingPeriodRef.current;
        const result = await apiGet<BootstrapPayload>(
          `/api/bootstrap${
            selectedPeriod ? `?mp=${encodeURIComponent(selectedPeriod)}` : ""
          }`,
        );
        const snapshot = result.data;
        const period = selectedPeriod ?? snapshot.me.activeMarkingPeriodId;
        if (cancelled) return;

        setMe(snapshot.me);
        setMarkingPeriod(period);
        markingPeriodRef.current = period;
        setCourses(snapshot.courses);
        setUpcoming(snapshot.upcoming);
        setLastUpdated(result.fetchedAt);
        setOffline(false);
        saveLastData({
          me: snapshot.me,
          courses: snapshot.courses,
          upcoming: snapshot.upcoming,
          fetchedAt: result.fetchedAt,
        });
        mergeWarnings(result.warnings);
        requestedDetails.current.clear();
        setDetails({});

        if (snapshot.me.mode === "demo") {
          await seedDemoSnapshots(snapshot.me, snapshot.courses);
        }
        const stored = await listSnapshots(snapshot.me.student.id);
        if (!cancelled) setSnapshots(stored);
      } catch (problem) {
        if (cancelled) return;
        if (problem instanceof SessionLostError) {
          handleSessionLost();
          return;
        }
        const fallback = loadLastData();
        if (
          fallback &&
          fallback.me.district.id === initialDistrictId &&
          fallback.me.student.id === initialStudentId
        ) {
          setMe(fallback.me);
          setCourses(fallback.courses);
          setUpcoming(fallback.upcoming);
          setMarkingPeriod(fallback.me.activeMarkingPeriodId);
          markingPeriodRef.current = fallback.me.activeMarkingPeriodId;
          setLastUpdated(fallback.fetchedAt);
          setOffline(true);
          setError("Showing the last record saved on this device.");
        } else {
          handleFailure(problem);
        }
      } finally {
        if (!cancelled) {
          setBooted(true);
          setRefreshing(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // markingPeriod is intentionally excluded: refresh should keep the current
    // term, and choosePeriod fetches its own course list.
  }, [
    refreshToken,
    initialDistrictId,
    initialStudentId,
    handleFailure,
    handleSessionLost,
    mergeWarnings,
  ]);

  useEffect(() => {
    if (!me || !courses || view === "more" || view === "tools") return;
    const pending = courses.filter(
      (course) => !requestedDetails.current.has(course.id),
    );
    if (pending.length === 0) return;
    for (const course of pending) requestedDetails.current.add(course.id);

    let cancelled = false;
    let idleHandle: number | null = null;
    let usedIdle = false;

    async function loadCourse(course: CourseSummary): Promise<boolean> {
      const query = markingPeriod
        ? `?mp=${encodeURIComponent(markingPeriod)}`
        : "";
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const result = await apiGet<Course>(
            `/api/courses/${encodeURIComponent(course.id)}${query}`,
          );
          if (cancelled) return true;
          setDetails((previous) => ({ ...previous, [course.id]: result.data }));
          mergeWarnings(result.warnings);
          return true;
        } catch (problem) {
          if (cancelled) return true;
          if (problem instanceof SessionLostError) {
            handleSessionLost();
            return true;
          }
          if (attempt === 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 700));
          }
        }
      }
      return false;
    }

    async function worker(queue: CourseSummary[]): Promise<void> {
      for (;;) {
        const course = queue.shift();
        if (!course || cancelled) return;
        if (!(await loadCourse(course))) {
          requestedDetails.current.delete(course.id);
        }
      }
    }

    const start = () => {
      if (cancelled) return;
      const queue = [...pending];
      // HAC throttles aggressively when a whole timetable is fetched at once;
      // two at a time keeps every page under the upstream timeout.
      void Promise.all(
        Array.from({ length: Math.min(2, queue.length) }, () => worker(queue)),
      );
    };

    // Course details are only needed for the missing-work list and Insights.
    // Let the first paint and the bootstrap request finish before asking HAC
    // for seven more pages, so the dashboard stops competing with itself.
    if (typeof window.requestIdleCallback === "function") {
      usedIdle = true;
      idleHandle = window.requestIdleCallback(start, { timeout: 2000 });
    } else {
      idleHandle = window.setTimeout(start, 900);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== null) {
        if (usedIdle) window.cancelIdleCallback(idleHandle);
        else window.clearTimeout(idleHandle);
      }
    };
  }, [view, courses, me, markingPeriod, mergeWarnings, handleSessionLost]);

  const courseSignature = useMemo(
    () =>
      JSON.stringify({
        student: me?.student.id ?? null,
        period: markingPeriod,
        courses: (courses ?? []).map((course) => [course.id, course.grade.percent]),
        details: Object.fromEntries(
          Object.entries(details).map(([id, course]) => [
            id,
            course.assignments.map((assignment) => [
              assignment.id,
              assignment.score,
              assignment.pointsPossible,
              assignment.percent,
              assignment.status,
            ]),
          ]),
        ),
      }),
    [me?.student.id, markingPeriod, courses, details],
  );

  useEffect(() => {
    if (!me || !courses) return;
    if (snapshotSignature.current === courseSignature) return;
    const timer = window.setTimeout(() => {
      snapshotSignature.current = courseSignature;
      const snapshot = buildSnapshot(me.student.id, markingPeriod, courses, details);
      void saveSnapshot(snapshot)
        .then(() => listSnapshots(me.student.id))
        .then((stored) => setSnapshots(stored))
        .catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [courseSignature, me, courses, markingPeriod, details]);

  const choosePeriod = async (next: string) => {
    if (!next || next === markingPeriod || !me) return;
    const sequence = ++periodSequence.current;
    setMarkingPeriod(next);
    markingPeriodRef.current = next;
    setCourses(null);
    setDetails({});
    requestedDetails.current.clear();
    setSelectedCourseId(null);
    setRefreshing(true);
    setError(null);

    try {
      const result = await apiGet<CourseSummary[]>(
        `/api/courses?mp=${encodeURIComponent(next)}`,
      );
      if (sequence !== periodSequence.current) return;
      setCourses(result.data);
      setWarnings(result.warnings);
      setLastUpdated(result.fetchedAt ?? new Date().toISOString());
      saveLastData({
        me,
        courses: result.data,
        upcoming: upcoming ?? [],
        fetchedAt: result.fetchedAt ?? new Date().toISOString(),
      });
    } catch (problem) {
      if (sequence !== periodSequence.current) return;
      handleFailure(problem);
      setCourses([]);
    } finally {
      if (sequence === periodSequence.current) setRefreshing(false);
    }
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
      const body = (await response.json().catch(() => null)) as {
        data?: unknown;
        error?: { code?: string; message?: string };
      } | null;
      if (response.status === 401 || body?.error?.code === "session_expired") {
        handleSessionLost();
        return;
      }
      if (!response.ok || body?.data === undefined) {
        setError(body?.error?.message ?? "Tesseract could not switch students.");
        return;
      }
      setDetails({});
      requestedDetails.current.clear();
      setSnapshots([]);
      setMarkingPeriod(null);
      markingPeriodRef.current = null;
      setRefreshToken((value) => value + 1);
      setView("home");
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
      // The HttpOnly cookie still needs a server request; return to the form.
    }
    router.replace("/");
    router.refresh();
  };

  const visibleCourses = useMemo(
    () => (courses ?? []).filter((course) => course.grade.percent !== null),
    [courses],
  );
  const overall = averagePercent(visibleCourses);
  const gpa = calculateGpa(visibleCourses, settings, settings.weightedGpa);

  const missing = useMemo(() => {
    const list: Array<{ course: CourseSummary; assignment: Course["assignments"][number] }> = [];
    for (const course of courses ?? []) {
      const detail = details[course.id];
      if (!detail) continue;
      for (const assignment of detail.assignments) {
        if (assignment.status === "missing") list.push({ course, assignment });
      }
    }
    return list.sort((a, b) =>
      (a.assignment.dueDate ?? "").localeCompare(b.assignment.dueDate ?? ""),
    );
  }, [courses, details]);

  const recentDiff = useMemo(
    () => diffSnapshots(snapshots[1] ?? null, snapshots[0] ?? null),
    [snapshots],
  );

  const selectedCourse = courses?.find((course) => course.id === selectedCourseId) ?? null;

  if (!me && !booted) {
    return (
      <main className={styles.loadingWrap}>
        <Glass className={styles.loadingCard}>
          <LogoMark size={52} title="Tesseract" />
          <h1 className={styles.loadingTitle}>Opening your record</h1>
          <p className={styles.loadingCopy}>
            Reading the current marking period from your district&apos;s Home
            Access Center.
          </p>
          <span aria-hidden="true" className={styles.loaderLine} />
        </Glass>
      </main>
    );
  }

  if (!me) {
    return (
      <main className={styles.loadingWrap}>
        <Glass className={styles.errorCard}>
          <LogoMark size={44} title="Tesseract" />
          <h1 className={styles.loadingTitle}>We couldn&apos;t open your record.</h1>
          <p className={styles.loadingCopy}>
            {error ?? "The session could not be read. Sign in again to continue."}
          </p>
          <div className={styles.errorActions}>
            <button
              className={styles.primaryButton}
              onClick={() => {
                setBooted(false);
                setError(null);
                setRefreshToken((value) => value + 1);
              }}
              type="button"
            >
              Try again
            </button>
            <button className={styles.secondaryButton} onClick={() => void signOut()} type="button">
              Sign out
            </button>
          </div>
        </Glass>
      </main>
    );
  }

  const firstName = me.student.displayName.split(/\s+/)[0] ?? me.student.displayName;
  const meta = VIEW_META[view];

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className={styles.appFrame}>
        <Glass
          aria-label="Workspace sidebar"
          className={styles.sidebar}
          innerClassName={styles.sidebarInner}
          role="complementary"
        >
          <div className={styles.brandRow}>
            <LogoMark size={34} title="Tesseract" />
            <div>
              <span className={styles.wordmark}>{SITE.wordmark}</span>
              <span className={styles.brandTag}>Every grade, in its place.</span>
            </div>
          </div>

          <div className={styles.studentCard}>
            <span aria-hidden="true" className={styles.avatar}>
              {initials(me.student.displayName)}
            </span>
            <span className={styles.studentText}>
              <span className={styles.studentName}>{me.student.displayName}</span>
              <span className={styles.studentMeta}>
                {[me.student.gradeLevel ? `Grade ${me.student.gradeLevel}` : null, me.student.school]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </div>

          {me.students.length > 1 ? (
            <label className={styles.sideControl}>
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

          <nav aria-label="Workspace" className={styles.sideNav}>
            {NAV.map((item) => (
              <button
                aria-current={view === item.id ? "page" : undefined}
                className={
                  view === item.id ? `${styles.navItem} ${styles.navActive}` : styles.navItem
                }
                key={item.id}
                onClick={() => setView(item.id)}
                type="button"
              >
                <span aria-hidden="true" className={styles.navIndex}>
                  {item.index}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className={styles.sideFoot}>
            <div className={styles.sideSync}>
              <span
                aria-hidden="true"
                className={offline || !online ? styles.syncDotOffline : styles.syncDot}
              />
              <span>
                {offline || !online
                  ? "Offline · last saved record"
                  : lastUpdated
                    ? `Updated ${new Date(lastUpdated).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}`
                    : "Not synced yet"}
              </span>
            </div>
            <button
              className={styles.secondaryButton}
              disabled={refreshing}
              onClick={() => setRefreshToken((value) => value + 1)}
              type="button"
            >
              {refreshing ? "Refreshing…" : "Refresh record"}
            </button>
            <button
              className={styles.textButton}
              disabled={signingOut}
              onClick={() => void signOut()}
              type="button"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </Glass>

        <div className={styles.main}>
          <Glass className={styles.topbar} innerClassName={styles.topbarInner} role="banner">
            <div className={styles.topbarTitleWrap}>
              <span className={styles.eyebrow}>{meta.eyebrow}</span>
              <h1 className={styles.topbarTitle}>
                {view === "home" ? `${greeting()}, ${firstName}.` : meta.title}
              </h1>
            </div>

            <div className={styles.topbarActions}>
              <label className={styles.topbarControl}>
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

              {me.students.length > 1 ? (
                <label className={styles.topbarControl}>
                  <span>Student</span>
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

              <span className={styles.syncBadge}>
                <span
                  aria-hidden="true"
                  className={refreshing ? `${styles.syncDot} ${styles.syncDotBusy}` : styles.syncDot}
                />
                {refreshing ? "Syncing" : offline || !online ? "Offline" : "Current"}
              </span>
            </div>
          </Glass>

          <main className={styles.content} id="main">
            {offline || !online ? (
              <div className={styles.offlineBanner} role="status">
                <span>
                  Offline — showing data from{" "}
                  {lastUpdated
                    ? new Date(lastUpdated).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "the last visit"}
                  .
                </span>
                <button
                  className={styles.textButton}
                  onClick={() => setRefreshToken((value) => value + 1)}
                  type="button"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {warnings.length > 0 ? (
              <details className={styles.warnings}>
                <summary>Some HAC pages came back incomplete · Review</summary>
                <ul>
                  {warnings.map((warning) => (
                    <li key={`${warning.code}|${warning.message}`}>{warning.message}</li>
                  ))}
                </ul>
              </details>
            ) : null}

            {error ? (
              <div className={styles.errorBar} role="alert">
                <span>{error}</span>
                <button
                  className={styles.textButton}
                  onClick={() => {
                    setError(null);
                    setRefreshToken((value) => value + 1);
                  }}
                  type="button"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {view === "home" ? (
              <HomeScreen
                courses={courses}
                gpa={gpa}
                lastUpdated={lastUpdated}
                me={me}
                missing={missing}
                onOpenCourse={setSelectedCourseId}
                onRefresh={() => setRefreshToken((value) => value + 1)}
                overall={overall}
                recentDiff={recentDiff}
                refreshing={refreshing}
                settings={settings}
                snapshots={snapshots}
                upcoming={upcoming}
              />
            ) : null}

            {view === "grades" ? (
              <GradesScreen
                courses={courses}
                key={`${me.student.id}:${markingPeriod ?? "current"}`}
                me={me}
                markingPeriod={markingPeriod}
                onOpenCourse={setSelectedCourseId}
                overall={overall}
                settings={settings}
                snapshots={snapshots}
              />
            ) : null}

            {view === "insights" ? (
              <InsightsScreen
                courses={courses ?? []}
                details={details}
                onOpenCourse={setSelectedCourseId}
                snapshots={snapshots}
              />
            ) : null}

            {view === "tools" ? (
              <ToolsScreen
                courses={courses ?? []}
                details={details}
                markingPeriod={markingPeriod}
                notify={notify}
                onSessionLost={handleSessionLost}
              />
            ) : null}

            {view === "more" ? (
              <MoreScreen
                courses={courses ?? []}
                me={me}
                notify={notify}
                onSessionLost={handleSessionLost}
                settings={settings}
                setSettings={setSettings}
                snapshots={snapshots}
                onSignOut={() => void signOut()}
              />
            ) : null}
          </main>

          <footer className={styles.footer}>
            <span>{SITE.legalNotice}</span>
            <a href="/privacy">Privacy</a>
          </footer>
        </div>
      </div>

      <Glass
        aria-label="Primary"
        className={styles.mobileTabs}
        innerClassName={styles.mobileTabsInner}
        role="navigation"
      >
        {NAV.map((item) => (
          <button
            aria-current={view === item.id ? "page" : undefined}
            className={
              view === item.id
                ? `${styles.mobileTab} ${styles.mobileTabActive}`
                : styles.mobileTab
            }
            key={item.id}
            onClick={() => setView(item.id)}
            type="button"
          >
            <span aria-hidden="true" className={styles.mobileIndex}>
              {item.index}
            </span>
            {item.label}
          </button>
        ))}
      </Glass>

      {selectedCourse ? (
        <CourseSheet
          cached={details[selectedCourse.id]}
          course={selectedCourse}
          key={`${selectedCourse.id}:${markingPeriod ?? "current"}`}
          markingPeriod={markingPeriod}
          onClose={closeCourse}
          onLoaded={handleDetailLoaded}
          onSessionLost={handleSessionLost}
          settings={settings}
          snapshots={snapshots}
        />
      ) : null}

      {toast ? (
        <div aria-live="polite" className={styles.toast} role="status">
          {toast}
        </div>
      ) : null}
    </>
  );
}
