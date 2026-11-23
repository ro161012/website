"use client";

import type {
  Course,
  CourseSummary,
  MeData,
  Snapshot,
  SnapshotCourse,
} from "@/lib/types";

const DB_NAME = "tesseract-local";
const DB_VERSION = 1;
const STORE = "snapshots";
const MAX_SNAPSHOTS = 240;

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("studentId", "studentId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB is unavailable."));
  });
}

export function hashAssignment(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

export function buildSnapshot(
  studentId: string,
  markingPeriodId: string | null,
  courses: CourseSummary[],
  details: Record<string, Course | undefined> = {},
): Snapshot {
  const now = new Date();
  return {
    id: `${studentId}:${now.getTime()}:${Math.random().toString(36).slice(2, 8)}`,
    studentId,
    markingPeriodId,
    capturedAt: now.toISOString(),
    courses: courses.map((course): SnapshotCourse => {
      const detail = details[course.id];
      const assignmentHashes: Record<string, string> = {};
      for (const assignment of detail?.assignments ?? []) {
        assignmentHashes[assignment.id] = hashAssignment(
          `${assignment.score ?? "null"}|${assignment.pointsPossible ?? "null"}|${
            assignment.percent ?? "null"
          }|${assignment.status}`,
        );
      }
      return {
        courseId: course.id,
        courseName: course.name,
        grade: course.grade,
        assignmentHashes,
      };
    }),
  };
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(snapshot);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Snapshot write failed."));
  });

  const all = await listSnapshots(snapshot.studentId);
  const stale = all.slice(MAX_SNAPSHOTS);
  if (stale.length > 0) {
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      for (const item of stale) store.delete(item.id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }
  db.close();
}

export async function listSnapshots(studentId: string): Promise<Snapshot[]> {
  if (!hasIndexedDb()) return [];
  const db = await openDb();
  const rows = await new Promise<Snapshot[]>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const index = transaction.objectStore(STORE).index("studentId");
    const request = index.getAll(studentId);
    request.onsuccess = () => resolve(request.result as Snapshot[]);
    request.onerror = () => reject(request.error ?? new Error("Snapshot read failed."));
  });
  db.close();
  return rows.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export async function listAllSnapshots(): Promise<Snapshot[]> {
  if (!hasIndexedDb()) return [];
  const db = await openDb();
  const rows = await new Promise<Snapshot[]>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as Snapshot[]);
    request.onerror = () => reject(request.error ?? new Error("Snapshot read failed."));
  });
  db.close();
  return rows.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export async function latestSnapshot(studentId: string): Promise<Snapshot | null> {
  const rows = await listSnapshots(studentId);
  return rows[0] ?? null;
}

/**
 * The demo must feel alive on first launch. Seed a few months of compact
 * averages so Insights has a real series without inventing a network call.
 */
export async function seedDemoSnapshots(me: MeData, courses: CourseSummary[]): Promise<void> {
  const existing = await listSnapshots(me.student.id);
  if (existing.length >= 4 || courses.length === 0) return;

  const now = Date.now();
  const seeds: Snapshot[] = [];
  for (let index = 0; index < 12; index += 1) {
    const ageDays = 88 - index * 8;
    const captured = new Date(now - ageDays * 86_400_000);
    seeds.push({
      id: `${me.student.id}:seed:${index}`,
      studentId: me.student.id,
      markingPeriodId: me.activeMarkingPeriodId,
      capturedAt: captured.toISOString(),
      courses: courses.map((course, courseIndex) => {
        const base = course.grade.percent ?? 88;
        const drift = Math.sin((index + courseIndex) * 0.8) * 2.2;
        const percent = Math.max(0, Math.min(100, Math.round((base - 3 + drift) * 10) / 10));
        return {
          courseId: course.id,
          courseName: course.name,
          grade: {
            percent,
            letter: course.grade.letter,
          },
          assignmentHashes: {},
        };
      }),
    });
  }

  for (const snapshot of seeds.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))) {
    await saveSnapshot(snapshot);
  }
}

export async function deleteLocalDatabase(): Promise<void> {
  if (!hasIndexedDb()) return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
