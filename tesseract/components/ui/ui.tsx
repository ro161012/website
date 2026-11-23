"use client";

import type { ReactNode } from "react";
import type { AssignmentStatus } from "@/lib/types";
import styles from "@/components/app/app.module.css";

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ id: T; label: string }>;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  return (
    <div
      aria-label={label}
      className={`${styles.segmented} ${compact ? styles.segmentedCompact : ""}`}
      role="group"
    >
      {options.map((option) => (
        <button
          aria-pressed={value === option.id}
          className={
            value === option.id
              ? `${styles.segment} ${styles.segmentActive}`
              : styles.segment
          }
          key={option.id}
          onClick={() => onChange(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyTitle}>{title}</span>
      <span>{body}</span>
      {action}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className={styles.skeletonWrap}>
      {Array.from({ length: rows }, (_, index) => (
        <span className={styles.skeleton} key={index} />
      ))}
    </div>
  );
}

const STATUS_LABELS: Record<AssignmentStatus, string> = {
  graded: "Graded",
  missing: "Missing",
  late: "Late",
  exempt: "Exempt",
  not_graded: "Not graded",
  unknown: "Unknown",
};

export function StatusChip({ status }: { status: AssignmentStatus }) {
  return (
    <span className={`${styles.chip} ${styles[`status_${status}`] ?? ""}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export interface ChartPoint {
  at: string;
  value: number;
}

function chartPath(points: ChartPoint[], width: number, height: number) {
  const padding = 16;
  const values = points.map((point) => point.value);
  const low = Math.max(0, Math.min(...values) - 3);
  const high = Math.min(100, Math.max(...values) + 3);
  const span = Math.max(1, high - low);
  const coordinates = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padding + (index * (width - padding * 2)) / (points.length - 1);
    const y = height - padding - ((point.value - low) / span) * (height - padding * 2);
    return [x, y] as const;
  });
  const line = coordinates
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const last = coordinates[coordinates.length - 1];
  const first = coordinates[0];
  const area =
    first && last
      ? `${line} L${last[0].toFixed(1)},${height - padding} L${first[0].toFixed(1)},${height - padding} Z`
      : "";
  return { coordinates, line, area, low, high };
}

export function LineChart({
  title,
  points,
  valueLabel = "Average",
}: {
  title: string;
  points: ChartPoint[];
  valueLabel?: string;
}) {
  if (points.length === 0) {
    return (
      <EmptyState
        body="Tesseract will draw this after a few visits. The data stays on this device."
        title="Collecting history"
      />
    );
  }

  const width = 640;
  const height = 190;
  const { coordinates, line, area } = chartPath(points, width, height);
  const readable = [...points].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <figure className={styles.chartFigure}>
      <svg
        aria-hidden="true"
        className={styles.chart}
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            className={styles.chartGrid}
            key={fraction}
            x1={16}
            x2={width - 16}
            y1={height * fraction}
            y2={height * fraction}
          />
        ))}
        <path className={styles.chartArea} d={area} />
        <path className={styles.chartLine} d={line} />
        {coordinates.map(([x, y], index) => (
          <circle
            className={styles.chartDot}
            cx={x}
            cy={y}
            key={`${points[index]?.at ?? index}-${index}`}
            r={index === coordinates.length - 1 ? 3.4 : 2}
          />
        ))}
      </svg>
      <figcaption className={styles.chartCaption}>
        <span>{title}</span>
        <span>
          {readable[0]?.value.toFixed(1)}% → {readable[readable.length - 1]?.value.toFixed(1)}%
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {readable.map((point) => (
            <tr key={point.at}>
              <td>{new Date(point.at).toLocaleDateString()}</td>
              <td>{point.value.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function Sparkline({ points }: { points: ChartPoint[] }) {
  if (points.length < 2) return null;
  const width = 240;
  const height = 58;
  const { line } = chartPath(points, width, height);
  return (
    <svg aria-hidden="true" className={styles.sparkline} viewBox={`0 0 ${width} ${height}`}>
      <path className={styles.sparkLine} d={line} />
    </svg>
  );
}

export function ProgressBar({
  value,
  label,
  tone = "default",
}: {
  value: number | null;
  label: string;
  tone?: "default" | "a" | "b" | "c" | "d" | "f";
}) {
  const clamped = Math.max(0, Math.min(100, value ?? 0));
  return (
    <span
      aria-label={`${label}: ${value === null ? "not available" : `${Math.round(value)} percent`}`}
      className={styles.progress}
      role="img"
    >
      <span
        className={`${styles.progressFill} ${tone === "default" ? "" : styles[`tone_${tone}`]}`}
        style={{ width: `${clamped}%` }}
      />
    </span>
  );
}
