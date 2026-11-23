const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const longDate = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const weekdayShort = new Intl.DateTimeFormat("en-US", { weekday: "short" });

const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

/** HAC dates are calendar dates; noon local avoids a timezone day shift. */
export function parseIsoDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function formatShortDate(value: string | null): string {
  if (!value) return "No date";
  return shortDate.format(parseIsoDate(value));
}

export function formatLongDate(value: string | null): string {
  if (!value) return "No date";
  return longDate.format(parseIsoDate(value));
}

export function formatDayNumber(value: string): string {
  return String(parseIsoDate(value).getDate());
}

export function formatWeekday(value: string): string {
  return weekdayShort.format(parseIsoDate(value));
}

export function formatMonth(month: string): string {
  const [yearText = "", monthText = ""] = month.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1, 15, 12);
  return monthLabel.format(date);
}

export function shiftMonth(month: string, delta: number): string {
  const [yearText = "", monthText = ""] = month.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1 + delta, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatPoints(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${formatPoints(value)}%`;
}

export function averageOf(values: Array<number | null>): number | null {
  const numbers = values.filter((value): value is number => value !== null);
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

export function letterForPercent(percent: number | null): string {
  if (percent === null) return "—";
  if (percent >= 93) return "A";
  if (percent >= 90) return "A-";
  if (percent >= 87) return "B+";
  if (percent >= 83) return "B";
  if (percent >= 80) return "B-";
  if (percent >= 77) return "C+";
  if (percent >= 73) return "C";
  if (percent >= 70) return "C-";
  if (percent >= 67) return "D+";
  if (percent >= 60) return "D";
  return "F";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase() || "T";
}

export function relativeDue(value: string | null): string {
  if (!value) return "No due date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseIsoDate(value);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return `${formatShortDate(value)} · past due`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 6) return weekdayShort.format(target);
  return formatShortDate(value);
}
