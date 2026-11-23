import type { Session } from "@/lib/session/schema";
import { DemoProvider } from "./demo";
import { HacProvider } from "./hac";
import type { DataProvider } from "./types";

export function getProvider(session: Session): DataProvider {
  return session.mode === "demo" ? new DemoProvider(session) : new HacProvider(session);
}
