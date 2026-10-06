/** All business dates are interpreted in Morocco time. */
export const BUSINESS_TZ = "Africa/Casablanca"

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

/** "YYYY-MM-DD" of an instant, in Morocco time. */
export function dayKey(d: Date): string {
  return dayFmt.format(d)
}

/** "YYYY-MM" of an instant, in Morocco time. */
export function monthKey(d: Date): string {
  return dayFmt.format(d).slice(0, 7)
}

/** Offset (ms) of BUSINESS_TZ from UTC at the given instant. */
function tzOffsetMs(at: Date): number {
  const p = Object.fromEntries(partsFmt.formatToParts(at).map((x) => [x.type, x.value]))
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/** Wall-clock time in BUSINESS_TZ -> UTC instant. */
function zonedToUtc(y: number, m: number, d: number, h: number, mi: number, s: number, ms: number): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi, s, ms)
  const first = guess - tzOffsetMs(new Date(guess))
  return new Date(guess - tzOffsetMs(new Date(first)))
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/** Start of a Morocco day. Accepts "YYYY-MM-DD" or a full ISO string (used as-is). */
export function startOfDay(input: string): Date {
  const m = DATE_ONLY.exec(input)
  if (!m) return new Date(input)
  return zonedToUtc(+m[1], +m[2], +m[3], 0, 0, 0, 0)
}

/** Last millisecond of a Morocco day. Accepts "YYYY-MM-DD" or a full ISO string (used as-is). */
export function endOfDay(input: string): Date {
  const m = DATE_ONLY.exec(input)
  if (!m) return new Date(input)
  return zonedToUtc(+m[1], +m[2], +m[3], 23, 59, 59, 999)
}

/** Today's date as "YYYY-MM-DD" in Morocco time. */
export function todayKey(): string {
  return dayKey(new Date())
}

/**
 * A calendar date picked by the user (rental pickup / return / event, expense date): "YYYY-MM-DD"
 * stored at 12:00 UTC of that day. It is a DAY, not an instant, so it must show the same day on
 * every device even when the server and a browser disagree about Morocco's clock by an hour.
 */
export function calendarDate(input: string): Date {
  const m = DATE_ONLY.exec(input.slice(0, 10))
  if (!m) return new Date(input)
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0, 0))
}

/**
 * "YYYY-MM-DD" that is certainly not later than today in Morocco, whatever the time-zone data of
 * this server says. Use it to refuse dates in the past without refusing "today" around midnight.
 */
export function earliestTodayKey(): string {
  return dayKey(new Date(Date.now() - 2 * 3_600_000))
}

/**
 * "YYYY-MM-DD" of a stored calendar date, read without any time-zone data (so the server and
 * every device always agree). The 2-hour nudge also reads correctly the older rows that were
 * stored at Morocco midnight (23:00 or 00:00 UTC) instead of noon.
 */
export function calendarKey(d: Date | string): string {
  const t = typeof d === "string" ? new Date(d) : d
  return new Date(t.getTime() + 2 * 3_600_000).toISOString().slice(0, 10)
}
