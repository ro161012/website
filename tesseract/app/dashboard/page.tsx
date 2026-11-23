import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Workspace } from "@/components/app/shell";
import { openSession, sessionCookieName } from "@/lib/session/crypto";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const token = (await cookies()).get(sessionCookieName())?.value;

  if (!token) redirect("/?expired=1");

  try {
    openSession(token);
  } catch {
    redirect("/?expired=1");
  }

  return (
    <div className={styles.dashboardPage}>
      <Workspace />
    </div>
  );
}
