"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  forgetDistrict,
  loadSavedDistricts,
  rememberDistrict,
  type SavedDistrict,
} from "@/lib/client/storage";
import {
  HAC_NETWORKS,
  type HacDistrictDirectory,
} from "@/lib/config/hac-networks";
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
  warnings?: Array<{ code?: string; message?: string }>;
}

interface DistrictDirectoryPayload {
  url: string;
  field: string | null;
  options: Array<{ id: string; name: string }>;
  selectedId: string | null;
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
  districtId?: string;
  districtName?: string;
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
      districtId: credentials.districtId,
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

export function LoginForm({
  defaultDistrictName,
  defaultDistrictUrl,
}: {
  defaultDistrictName: string;
  defaultDistrictUrl: string;
}) {
  const router = useRouter();
  const [districtUrl, setDistrictUrl] = useState(defaultDistrictUrl);
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [districtName, setDistrictName] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedDistrict[]>([]);
  const [network, setNetwork] = useState("");
  const [directory, setDirectory] = useState<HacDistrictDirectory | null>(null);
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const directoryRequest = useRef(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [stay, setStay] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [vaultAvailable, setVaultAvailable] = useState(false);
  const [vaultDate, setVaultDate] = useState<string | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [districtOpen, setDistrictOpen] = useState(false);
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
  const normalizedDefault = useMemo(
    () => normalizeDistrict(defaultDistrictUrl),
    [defaultDistrictUrl],
  );
  const activeDistrict = normalizedPreview ?? normalizedDefault;
  const activeHost = activeDistrict ? new URL(activeDistrict).hostname : null;
  const defaultHost = normalizedDefault ? new URL(normalizedDefault).hostname : null;
  const usingDefault =
    !districtId &&
    (normalizedPreview === null || normalizedPreview === normalizedDefault);
  const activeDistrictName =
    districtName ??
    (usingDefault ? defaultDistrictName : activeHost ?? "Choose a district");

  async function loadDistricts(url: string): Promise<void> {
    const requestId = directoryRequest.current + 1;
    directoryRequest.current = requestId;
    setDirectoryBusy(true);
    setDirectoryError(null);
    setDirectory(null);
    setDistrictId(null);
    setDistrictName(null);

    try {
      const response = await fetch(
        `/api/hac/districts?url=${encodeURIComponent(url)}`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        },
      );
      const body = (await response
        .json()
        .catch(() => null)) as Envelope<DistrictDirectoryPayload> | null;

      if (requestId !== directoryRequest.current) return;

      if (!response.ok || !body?.data) {
        setDirectoryError(
          body?.error?.message ??
            "Could not read the district list from that HAC address.",
        );
        return;
      }

      if (body.data.options.length === 0) {
        setDirectoryError(
          body.warnings?.find((warning) => warning.message)?.message ??
            "This HAC address does not show a district picker.",
        );
        return;
      }

      setDirectory({
        field: body.data.field ?? "Database",
        options: body.data.options,
        selectedId: body.data.selectedId,
      });
    } catch {
      if (requestId === directoryRequest.current) {
        setDirectoryError("Could not load districts. Check your connection.");
      }
    } finally {
      if (requestId === directoryRequest.current) setDirectoryBusy(false);
    }
  }

  function resetDistrictSelection(): void {
    setDistrictId(null);
    setDistrictName(null);
    setDirectory(null);
    setDirectoryError(null);
    setNetwork("");
  }

  function chooseNetwork(id: string): void {
    setNetwork(id);
    const selected = HAC_NETWORKS.find((candidate) => candidate.id === id);
    if (!selected) {
      setDistrictUrl(defaultDistrictUrl);
      resetDistrictSelection();
      return;
    }
    setDistrictUrl(selected.url);
    setDistrictId(null);
    setDistrictName(null);
    setDirectory(null);
    setDirectoryError(null);
    void loadDistricts(selected.url);
  }

  function chooseDistrict(id: string): void {
    if (!id) {
      setDistrictId(null);
      setDistrictName(null);
      return;
    }
    const selected = directory?.options.find((candidate) => candidate.id === id);
    if (!selected) return;
    setDistrictId(selected.id);
    setDistrictName(selected.name);
  }

  async function finish(credentials: VaultCredentials, remember: boolean) {
    const result = await postLogin(credentials);
    if (!result.ok) throw new Error(result.message);
    if (remember) {
      rememberDistrict({
        url: credentials.districtUrl,
        districtId: credentials.districtId,
        districtName: credentials.districtName,
      });
    }
    router.replace("/dashboard");
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);

    const normalized = normalizeDistrict(districtUrl);
    if (!normalized) {
      setDistrictOpen(true);
      setError(
        "Enter the complete HTTPS address of your district's HAC, or use the default district.",
      );
      return;
    }
    if (network && !districtId) {
      setDistrictOpen(true);
      setError(
        directoryError ??
          "Choose your district from the loaded list before signing in.",
      );
      return;
    }
    if (directory && !districtId) {
      setDistrictOpen(true);
      setError("Choose your district from the list before signing in.");
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
      ...(districtId
        ? { districtId, districtName: districtName ?? undefined }
        : {}),
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
      setDistrictId(credentials.districtId ?? null);
      setDistrictName(credentials.districtName ?? null);
      setNetwork("");
      setDirectory(null);
      setDirectoryError(null);
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
        <div className={styles.districtRow}>
          <div className={styles.districtCopy}>
            <span className={styles.districtLabel}>District</span>
            <span className={styles.districtName}>{activeDistrictName}</span>
            <span className={styles.districtHost}>
              {usingDefault
                ? defaultHost ?? "Default district not configured"
                : districtName
                  ? "Selected from a HAC network"
                  : "Custom HAC address"}
            </span>
          </div>
          <button
            aria-controls="district-panel"
            aria-expanded={districtOpen}
            className={styles.textButton}
            onClick={() => setDistrictOpen((open) => !open)}
            type="button"
          >
            {districtOpen ? "Done" : "Change"}
          </button>
        </div>

        {districtOpen ? (
          <div className={styles.districtPanel} id="district-panel">
            <div className={styles.field}>
              <label htmlFor="district-network">Find your district</label>
              <select
                className={styles.select}
                disabled={busy || directoryBusy}
                id="district-network"
                onChange={(event) => chooseNetwork(event.target.value)}
                value={network}
              >
                <option value="">Choose a HAC network</option>
                {HAC_NETWORKS.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label} — {candidate.note}
                  </option>
                ))}
              </select>
              <span className={styles.help}>
                Shared HAC networks with district pickers. Choose one to load
                every district it publishes.
              </span>
            </div>

            {directoryBusy ? (
              <p className={styles.help} role="status">
                Loading districts…
              </p>
            ) : null}

            {directoryError ? (
              <p className={styles.error} role="alert">
                {directoryError}
              </p>
            ) : null}

            {directory ? (
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label htmlFor="district-choice">District</label>
                  <span className={styles.help}>
                    {directory.options.length} found
                  </span>
                </div>
                <select
                  className={styles.select}
                  disabled={busy}
                  id="district-choice"
                  onChange={(event) => chooseDistrict(event.target.value)}
                  value={districtId ?? ""}
                >
                  <option value="">Select your district</option>
                  {directory.options.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
                <span className={styles.help}>
                  {districtName
                    ? `Autofilled: ${districtName}`
                    : "Choose your district to autofill the sign-in."}
                </span>
              </div>
            ) : null}

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor="district-url">District HAC address</label>
                {saved.length > 0 ? (
                  <select
                    aria-label="Saved districts"
                    className={styles.savedSelect}
                    onChange={(event) => {
                      const entry = saved[Number(event.target.value)];
                      if (!entry) return;
                      setDistrictUrl(entry.url);
                      setDistrictId(entry.districtId ?? null);
                      setDistrictName(entry.districtName ?? null);
                      setNetwork("");
                      setDirectory(null);
                      setDirectoryError(null);
                    }}
                    value=""
                  >
                    <option value="">Saved districts</option>
                    {saved.map((entry, index) => (
                      <option key={`${entry.url}:${entry.districtId ?? ""}`} value={index}>
                        {entry.districtName ?? new URL(entry.url).hostname}
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
                onChange={(event) => {
                  setDistrictUrl(event.target.value);
                  setDistrictId(null);
                  setDistrictName(null);
                  setDirectory(null);
                  setDirectoryError(null);
                  setNetwork("");
                }}
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
              <div className={styles.districtActions}>
                {!usingDefault ? (
                  <button
                    className={styles.textButton}
                    disabled={busy || directoryBusy}
                    onClick={() => void loadDistricts(districtUrl)}
                    type="button"
                  >
                    Find districts at this address
                  </button>
                ) : null}
                <button
                  className={styles.textButton}
                  disabled={busy || directoryBusy}
                  onClick={() => {
                    setDistrictUrl(defaultDistrictUrl);
                    resetDistrictSelection();
                  }}
                  type="button"
                >
                  Use {defaultDistrictName}
                </button>
              </div>
            </div>
          </div>
        ) : null}

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
            {saved.map((entry) => (
              <li key={`${entry.url}:${entry.districtId ?? ""}`}>
                <span>
                  {entry.districtName ?? new URL(entry.url).hostname}
                </span>
                <button
                  className={styles.textButton}
                  onClick={() => {
                    setSaved(forgetDistrict(entry.url, entry.districtId));
                    if (
                      districtUrl === entry.url &&
                      districtId === (entry.districtId ?? null)
                    ) {
                      setDistrictUrl(defaultDistrictUrl);
                      resetDistrictSelection();
                    }
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
