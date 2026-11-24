import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { SITE } from "@/lib/config/site";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Tesseract stores, where it lives, and what it never does with your grades.",
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <article className={`${styles.card} surface`}>
        <header className={styles.head}>
          <Link className={styles.brand} href="/">
            <LogoMark size={34} title="Tesseract" />
            <span>{SITE.wordmark}</span>
          </Link>
          <Link className={styles.back} href="/">
            Back
          </Link>
        </header>

        <p className={styles.eyebrow}>Plain language</p>
        <h1 className={styles.title}>Privacy note</h1>
        <p className={styles.lede}>
          Tesseract is a reader for your own Home Access Center record. It is not
          a grade database, an analytics product or a social network.
        </p>

        <section>
          <h2>What leaves your browser</h2>
          <p>
            Your district address, username and password are sent once over HTTPS
            to this app&apos;s server so it can perform the HAC sign-in. The
            password is used for that upstream request and discarded. It is never
            written to a file, database, log or URL.
          </p>
          <p>
            When you use district autofill, only the public HAC address is sent to
            our server. It fetches that sign-in page to read the district names;
            no username, password or student data is involved.
          </p>
          <p>
            The encrypted session cookie contains the HAC cookie jar, the district,
            the student list and an expiry — not grades and not your password. It
            is HttpOnly, SameSite=Strict, Secure in production, and lasts at most
            12 hours.
          </p>
        </section>

        <section>
          <h2>What stays on this device</h2>
          <p>
            Settings, saved districts, course order, compact grade snapshots, and
            — only if you ask — an encrypted saved sign-in live in this
            browser&apos;s local storage and IndexedDB. The saved sign-in is
            encrypted with PBKDF2 and AES-GCM behind your master password. It is
            never sent to our server.
          </p>
          <p>
            Settings has an export button for the local history, a delete-local-data
            button, and a combined sign-out-and-delete action. The app shell is
            cached by a service worker; grade API responses are not.
          </p>
        </section>

        <section>
          <h2>What we do not do</h2>
          <ul>
            <li>No third-party analytics, ads, tracking pixels or data brokers.</li>
            <li>No grade database in v1.</li>
            <li>No writing to HAC, messaging teachers, or changing assignments.</li>
            <li>No bypassing CAPTCHA, hardware MFA or district SSO.</li>
            <li>No storing your password server-side.</li>
          </ul>
        </section>

        <section>
          <h2>Your choices</h2>
          <p>
            Use <strong>More → Settings → Delete local data</strong> to remove
            everything Tesseract keeps in this browser. To end the server session,
            sign out. If you saved a sign-in, delete it from the login screen or
            Settings.
          </p>
        </section>

        <p className={styles.legal}>{SITE.legalNotice}</p>

        <Link className={styles.back} href="/">
          Return to Tesseract
        </Link>
      </article>
    </main>
  );
}
