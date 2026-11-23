import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { LogoMark } from "@/components/brand/logo-mark";
import { Glass } from "@/components/glass/glass";
import { SITE } from "@/lib/config/site";
import { getHacDistrictUrl } from "@/lib/config/hac";
import { openSession, sessionCookieName } from "@/lib/session/crypto";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const token = (await cookies()).get(sessionCookieName())?.value;
  let signedIn = false;

  if (token) {
    try {
      openSession(token);
      signedIn = true;
    } catch {
      // An expired or invalid cookie should show the form, not an error.
    }
  }

  if (signedIn) redirect("/dashboard");

  const params = await searchParams;
  if (params.demo === "1") redirect("/api/auth/demo");

  const expired = params.expired === "1";
  const demoLimited = params.demo === "limited";

  return (
    <main className={styles.page}>
      <div className={styles.center}>
        <Glass className={styles.card}>
          <header className={styles.brandRow}>
            <div className={styles.brand}>
              <LogoMark size={38} title="Tesseract" />
              <span className={styles.wordmark}>{SITE.wordmark}</span>
            </div>
            <span className={styles.tagline}>{SITE.tagline}</span>
          </header>

          <p className={styles.eyebrow}>Grade intelligence</p>
          <h1 className={styles.title}>Sign in.</h1>
          <p className={styles.lede}>
            Your district&apos;s Home Access Center, read clearly. Nothing is
            stored on our servers and nothing is written back to HAC.
          </p>

          {expired ? (
            <p className={styles.notice} role="status">
              Your session ended. Sign in again to continue.
            </p>
          ) : null}
          {demoLimited ? (
            <p className={styles.notice} role="status">
              Demo mode is rate-limited right now. Try again in a minute.
            </p>
          ) : null}

          <LoginForm defaultDistrictUrl={getHacDistrictUrl()} />
        </Glass>

        <footer className={styles.legal}>
          <p>{SITE.legalNotice}</p>
        </footer>
      </div>
    </main>
  );
}
