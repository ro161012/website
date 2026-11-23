"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  forgetDistrict,
  loadSavedDistricts,
  rememberDistrict,
} from "@/lib/client/storage";
import {
  clearVault,
  hasVault,
  saveVault,
  unlockVault,
  vaultCreatedAt,
  type VaultCredentials,
} from "@/lib/client/vault";
import styles from "@/app/page.module.css";

interface Envelope<T> {
  data?: T;
  error?: { code?: string; message?: string };
}

interface LoginPayload {
  status: "authenticated" | "mfa_required";
}

function normalizeDistrict(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${pathname}`;
  } catch {
    return null;
  }
}

async function postLogin(credentials: {
  districtUrl: string;
  username: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      districtUrl: credentials.districtUrl,
      username: credentials.username.trim(),
      password: credentials.password,
    }),
  });

  const body = (await response
    .json()
    .catch(() => null)) as Envelope<LoginPayload> | null;

  if (!response.ok || !body?.data) {
    return {
      ok: false,
      message:
        body?.error?.message ??
        "Sign-in failed. Check the district address, username and password.",
    };
  }

  if (body.data.status === "mfa_required") {
    return {
      ok: false,
      message:
        "This account needs extra verification. Sign in through HAC directly.",
    };
  }

  return { ok: true };
}

export function LoginForm({ defaultDistrictUrl }: { defaultDistrictUrl: string }) {
  const router = useRouter();
  const [districtUrl, setDistrictUrl] = useState(defaultDistrictUrl);
  const [saved, setSaved] = useState<string[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [stay, setStay] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [vaultAvailable, setVaultAvailable] = useState(false);
  const [vaultDate, setVaultDate] = useState<string | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setSaved(loadSavedDistricts());
      setVaultAvailable(hasVault());
      setVaultDate(vaultCreatedAt());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const normalizedPreview = useMemo(() => normalizeDistrict(districtUrl), [districtUrl]);

  async function finish(credentials: VaultCredentials, remember: boolean) {
    if (remember) rememberDistrict(credentials.districtUrl);
    const result = await postLogin(credentials);
    if (!result.ok) throw new Error(result.message);
    router.replace("/dashboard");
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);

    const normalized = normalizeDistrict(districtUrl);
    if (!normalized) {
      setError("Enter the complete HTTPS address of your district's HAC.");
      return;
    }
    if (stay && masterPassword.length < 8) {
      setError("Use a master password of at least 8 characters to save this sign-in.");
      return;
    }

    setBusy(true);
    const credentials: VaultCredentials = {
      districtUrl: normalized,
      username: username.trim(),
      password,
    };

    try {
      await finish(credentials, true);
      if (stay) {
        try {
          await saveVault(credentials, masterPassword);
        } catch {
          // Sign-in already succeeded; a vault failure must not undo it.
        }
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  async function unlockSaved(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (!masterPassword) {
      setError("Enter the master password for the saved sign-in.");
      return;
    }
    setBusy(true);
    try {
      const credentials = await unlockVault(masterPassword);
      setDistrictUrl(credentials.districtUrl);
      setUsername(credentials.username);
      await finish(credentials, true);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "The saved sign-in could not be unlocked.",
      );
      setBusy(false);
    }
  }

  function forgetSaved() {
    clearVault();
    setVaultAvailable(false);
    setVaultDate(null);
    setVaultOpen(false);
    setMasterPassword("");
  }

  return (
    <>
      {vaultAvailable && !vaultOpen ? (
        <div className={styles.vaultBanner}>
          <div>
            <strong>Saved sign-in on this device</strong>
            <span>
              {vaultDate
                ? `Saved ${new Date(vaultDate).toLocaleDateString()}`
                : "Encrypted with your master password"}
            </span>
          </div>
          <button
            className={styles.textButton}
            onClick={() => setVaultOpen(true)}
            type="button"
          >
            Unlock
          </button>
        </div>
      ) : null}

      {vaultOpen ? (
        <form className={styles.vaultForm} onSubmit={unlockSaved}>
          <div className={styles.field}>
            <label htmlFor="vault-password">Master password</label>
            <input
              autoComplete="current-password"
              disabled={busy}
              id="vault-password"
              onChange={(event) => setMasterPassword(event.target.value)}
              required
              type="password"
              value={masterPassword}
            />
          </div>
          <div className={styles.vaultActions}>
            <button className={styles.primaryButton} disabled={busy} type="submit">
              {busy ? "Unlocking…" : "Unlock saved sign-in"}
            </button>
            <button
              className={styles.textButton}
              onClick={forgetSaved}
              type="button"
            >
              Forget it
            </button>
          </div>
        </form>
      ) : null}

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor="district-url">District HAC address</label>
            {saved.length > 0 ? (
              <select
                aria-label="Saved districts"
                className={styles.savedSelect}
                onChange={(event) => {
                  if (event.target.value) setDistrictUrl(event.target.value);
                }}
                value=""
              >
                <option value="">Saved districts</option>
                {saved.map((value) => (
                  <option key={value} value={value}>
                    {new URL(value).hostname}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <input
            aria-describedby="district-help"
            autoComplete="url"
            disabled={busy}
            id="district-url"
            inputMode="url"
            onChange={(event) => setDistrictUrl(event.target.value)}
            placeholder="https://access.yourdistrict.org/HomeAccess"
            required
            spellCheck={false}
            type="url"
            value={districtUrl}
          />
          <span className={styles.help} id="district-help">
            {normalizedPreview
              ? `Will connect to ${normalizedPreview}`
              : "Paste the HTTPS address from your district's HAC sign-in page."}
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="username">Username</label>
          <input
            autoCapitalize="none"
            autoComplete="username"
            disabled={busy}
            id="username"
            name="username"
            onChange={(event) => setUsername(event.target.value)}
            required
            spellCheck={false}
            type="text"
            value={username}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor="password">Password</label>
            <button
              aria-pressed={showPassword}
              className={styles.textButton}
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <input
            autoComplete="current-password"
            disabled={busy}
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
        </div>

        <label className={styles.checkRow}>
          <input
            checked={stay}
            disabled={busy}
            onChange={(event) => setStay(event.target.checked)}
            type="checkbox"
          />
          <span>
            Stay signed in on this device
            <small>Encrypted with a master password you choose. Never stored in plain text.</small>
          </span>
        </label>

        {stay ? (
          <div className={styles.field}>
            <label htmlFor="master-password">Master password</label>
            <input
              autoComplete="new-password"
              disabled={busy}
              id="master-password"
              minLength={8}
              onChange={(event) => setMasterPassword(event.target.value)}
              placeholder="At least 8 characters"
              required
              type="password"
              value={masterPassword}
            />
          </div>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <button className={styles.primaryButton} disabled={busy} type="submit">
          <span>{busy ? "Signing in…" : "Sign in"}</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>

      <div className={styles.demoRow}>
        <span>Just looking?</span>
        <a className={styles.demoButton} href="/api/auth/demo">
          Open demo mode
        </a>
      </div>

      <p className={styles.privacyNote}>
        Your password is used once for the HAC handshake and never stored on the
        server. Read the <a href="/privacy">privacy note</a>.
      </p>

      {saved.length > 0 ? (
        <details className={styles.savedDetails}>
          <summary>Manage saved districts</summary>
          <ul>
            {saved.map((value) => (
              <li key={value}>
                <span>{new URL(value).hostname}</span>
                <button
                  className={styles.textButton}
                  onClick={() => {
                    setSaved(forgetDistrict(value));
                    if (districtUrl === value) setDistrictUrl(defaultDistrictUrl);
                  }}
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
