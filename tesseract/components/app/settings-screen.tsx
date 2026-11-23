"use client";

import { useState } from "react";
import type { CourseLevel, MeData, Snapshot } from "@/lib/types";
import type { AppSettings, ThemeChoice } from "@/lib/client/storage";
import {
  clearAllLocalData,
  clearLastData,
  clearLocalSettings,
  exportLocalData,
} from "@/lib/client/storage";
import { clearVault, hasVault } from "@/lib/client/vault";
import { SITE } from "@/lib/config/site";
import { Segmented } from "@/components/ui/ui";
import styles from "./app.module.css";

const ACCENTS = ["#df7257", "#7f6fb2", "#62d6b1", "#7cc4e8", "#e7c66b", "#ef8b7e"];
const LEVELS: CourseLevel[] = [
  "regular",
  "honors",
  "ap",
  "ib",
  "dual_enrollment",
  "other",
];

export function SettingsScreen({
  me,
  settings,
  setSettings,
  snapshots,
  notify,
  onSignOut,
}: {
  me: MeData;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  snapshots: Snapshot[];
  notify: (message: string) => void;
  onSignOut: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [vaultPresent, setVaultPresent] = useState(() => hasVault());

  const update = (patch: Partial<AppSettings>) => {
    setSettings((previous) => ({ ...previous, ...patch }));
  };

  async function downloadExport() {
    const json = await exportLocalData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tesseract-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Local data exported");
  }

  async function deleteLocal() {
    if (!window.confirm("Delete all Tesseract settings and local history from this browser?")) {
      return;
    }
    setDeleting(true);
    await clearAllLocalData();
    clearVault();
    clearLastData();
    clearLocalSettings();
    setVaultPresent(false);
    setDeleting(false);
    notify("Local data deleted");
  }

  async function deleteAndSignOut() {
    if (
      !window.confirm(
        "Sign out and delete every Tesseract setting, snapshot and saved sign-in on this device?",
      )
    ) {
      return;
    }
    setDeleting(true);
    await clearAllLocalData();
    clearVault();
    clearLastData();
    clearLocalSettings();
    onSignOut();
  }

  return (
    <div className={styles.settingsGrid}>
      <section className={`${styles.panel} surface`} aria-labelledby="appearance-title">
        <div className={styles.panelHead}>
          <div>
            <span className={styles.panelKicker}>Appearance</span>
            <h2 className={styles.panelTitle} id="appearance-title">
              Theme & glass
            </h2>
          </div>
        </div>

        <div className={styles.settingRow}>
          <div>
            <span className={styles.settingLabel}>Theme</span>
            <span className={styles.settingHelp}>System follows your operating system.</span>
          </div>
          <Segmented
            compact
            label="Theme"
            onChange={(value: ThemeChoice) => update({ theme: value })}
            options={[
              { id: "system", label: "System" },
              { id: "light", label: "Light" },
              { id: "dark", label: "Dark" },
            ]}
            value={settings.theme}
          />
        </div>

        <div className={styles.settingRow}>
          <div>
            <span className={styles.settingLabel}>Accent</span>
            <span className={styles.settingHelp}>Used for focus and active states.</span>
          </div>
          <div className={styles.swatches}>
            {ACCENTS.map((color) => (
              <button
                aria-label={`Use ${color} accent`}
                aria-pressed={settings.accent === color}
                className={
                  settings.accent === color ? `${styles.swatch} ${styles.swatchActive}` : styles.swatch
                }
                key={color}
                onClick={() => update({ accent: color })}
                style={{ backgroundColor: color }}
                type="button"
              />
            ))}
            <input
              aria-label="Custom accent color"
              className={styles.colorInput}
              onChange={(event) => update({ accent: event.target.value })}
              type="color"
              value={settings.accent}
            />
          </div>
        </div>

        <label className={styles.settingRow}>
          <div>
            <span className={styles.settingLabel}>Glass intensity</span>
            <span className={styles.settingHelp}>
              {settings.glassIntensity}% · tint, rim and refraction scale together.
            </span>
          </div>
          <input
            aria-valuetext={`${settings.glassIntensity} percent`}
            className={styles.range}
            max={100}
            min={0}
            onChange={(event) => update({ glassIntensity: Number(event.target.value) })}
            step={5}
            type="range"
            value={settings.glassIntensity}
          />
        </label>

        <label className={styles.settingRow}>
          <div>
            <span className={styles.settingLabel}>Reduce motion</span>
            <span className={styles.settingHelp}>
              Collapses transitions and lift effects. Glass stays visible.
            </span>
          </div>
          <input
            checked={settings.reduceMotion}
            className={styles.toggle}
            onChange={(event) => update({ reduceMotion: event.target.checked })}
            type="checkbox"
          />
        </label>
      </section>

      <section className={`${styles.panel} surface`} aria-labelledby="grades-title">
        <div className={styles.panelHead}>
          <div>
            <span className={styles.panelKicker}>Grades</span>
            <h2 className={styles.panelTitle} id="grades-title">
              Color & thresholds
            </h2>
          </div>
        </div>

        <label className={styles.settingRow}>
          <div>
            <span className={styles.settingLabel}>Color-code scores</span>
            <span className={styles.settingHelp}>
              The percent and letter always remain visible.
            </span>
          </div>
          <input
            checked={settings.colorCode}
            className={styles.toggle}
            onChange={(event) => update({ colorCode: event.target.checked })}
            type="checkbox"
          />
        </label>

        <div className={styles.thresholdGrid}>
          {(
            [
              ["a", "A"],
              ["b", "B"],
              ["c", "C"],
              ["d", "D"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <span>{label} at or above</span>
              <input
                className={styles.input}
                max={100}
                min={0}
                onChange={(event) =>
                  update({
                    thresholds: {
                      ...settings.thresholds,
                      [key]: Number(event.target.value),
                    },
                  })
                }
                step={1}
                type="number"
                value={settings.thresholds[key]}
              />
            </label>
          ))}
        </div>
      </section>

      <section className={`${styles.panel} surface`} aria-labelledby="gpa-settings-title">
        <div className={styles.panelHead}>
          <div>
            <span className={styles.panelKicker}>GPA</span>
            <h2 className={styles.panelTitle} id="gpa-settings-title">
              Scale & level weights
            </h2>
          </div>
        </div>

        <div className={styles.settingRow}>
          <div>
            <span className={styles.settingLabel}>Scale</span>
            <span className={styles.settingHelp}>4.0 or 5.0.</span>
          </div>
          <Segmented
            compact
            label="GPA scale"
            onChange={(value) => update({ gpaScale: value === "5" ? 5 : 4 })}
            options={[
              { id: "4", label: "4.0" },
              { id: "5", label: "5.0" },
            ]}
            value={String(settings.gpaScale)}
          />
        </div>

        <label className={styles.settingRow}>
          <div>
            <span className={styles.settingLabel}>Weighted by default</span>
            <span className={styles.settingHelp}>Use honors/AP/IB bonuses.</span>
          </div>
          <input
            checked={settings.weightedGpa}
            className={styles.toggle}
            onChange={(event) => update({ weightedGpa: event.target.checked })}
            type="checkbox"
          />
        </label>

        <div className={styles.thresholdGrid}>
          {LEVELS.map((level) => (
            <label key={level}>
              <span>{level.replace("_", " ")} bonus</span>
              <input
                className={styles.input}
                max={2}
                min={0}
                onChange={(event) =>
                  update({
                    levelWeights: {
                      ...settings.levelWeights,
                      [level]: Number(event.target.value),
                    },
                  })
                }
                step={0.1}
                type="number"
                value={settings.levelWeights[level]}
              />
            </label>
          ))}
        </div>
      </section>

      <section className={`${styles.panel} surface`} aria-labelledby="data-title">
        <div className={styles.panelHead}>
          <div>
            <span className={styles.panelKicker}>This browser</span>
            <h2 className={styles.panelTitle} id="data-title">
              Local data
            </h2>
          </div>
        </div>
        <p className={styles.muted}>
          {snapshots.length} snapshots · {vaultPresent ? "encrypted saved sign-in present" : "no saved sign-in"} ·
          settings and saved districts live in this browser.
        </p>
        <div className={styles.buttonRow}>
          <button className={styles.secondaryButton} onClick={() => void downloadExport()} type="button">
            Export JSON
          </button>
          <button
            className={styles.dangerButton}
            disabled={deleting}
            onClick={() => void deleteLocal()}
            type="button"
          >
            Delete local data
          </button>
          <button
            className={styles.dangerButton}
            disabled={deleting}
            onClick={() => void deleteAndSignOut()}
            type="button"
          >
            Sign out & delete everything
          </button>
        </div>
        <button className={styles.textButton} onClick={onSignOut} type="button">
          Sign out only
        </button>
      </section>

      <section className={`${styles.panel} surface`} aria-labelledby="about-title">
        <div className={styles.panelHead}>
          <div>
            <span className={styles.panelKicker}>About</span>
            <h2 className={styles.panelTitle} id="about-title">
              Tesseract
            </h2>
          </div>
        </div>
        <p className={styles.muted}>
          Signed in as {me.student.displayName} · {me.district.name} ·{" "}
          {me.mode === "demo" ? "demo data" : "HAC session"}.
        </p>
        <p className={styles.legalCopy}>{SITE.legalNotice}</p>
        <a className={styles.secondaryButton} href="/privacy">
          Privacy note
        </a>
      </section>
    </div>
  );
}
