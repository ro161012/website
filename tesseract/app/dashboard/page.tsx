import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Workspace } from "@/components/app/shell";
import {
  logoutCookieName,
  openSession,
  sessionCookieName,
} from "@/lib/session/crypto";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  const loggedOut = cookieStore.get(logoutCookieName())?.value === "1";

  if (!token || loggedOut) redirect("/?expired=1");

  let session;
  try {
    session = openSession(token);
  } catch {
    redirect("/?expired=1");
  }

  return (
    <div className={styles.dashboardPage}>
      <Workspace
        initialDistrictId={session.district.id}
        initialStudentId={session.activeStudentId}
      />
    </div>
  );
}
