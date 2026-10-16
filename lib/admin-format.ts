export function usd(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function compact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function shortDay(isoDay: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDay}T00:00:00Z`),
  );
}

export function dateLabel(iso: string | Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(iso),
  );
}

/** "3 min ago", "2 days ago", "never". */
export function relativeTime(iso: string | Date | null, now = Date.now()) {
  if (!iso) return "never";
  const seconds = Math.max(Math.round((now - new Date(iso).getTime()) / 1000), 0);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(-Math.round(seconds / size), unit);
  }
  return "just now";
}
