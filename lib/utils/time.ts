/**
 * Business clock: every "day", "month" and "4 o'clock" in the ERP is Morocco time.
 *
 * Morocco is on UTC+0 (checked on 2026-10-06 against the shop computer and current browsers).
 * The offset is written here on purpose instead of asking the server's time-zone database:
 * that database was one hour wrong on the server (it still believed UTC+1), which shifted the
 * business day, the reports and the clock shown in messages.
 *
 * If Morocco changes its clock again, set NEXT_PUBLIC_BUSINESS_UTC_OFFSET_MINUTES (for example
 * 60 for UTC+1) in the hosting settings and redeploy. Nothing else has to change.
 */
const fromEnv = Number(process.env.NEXT_PUBLIC_BUSINESS_UTC_OFFSET_MINUTES)
export const BUSINESS_UTC_OFFSET_MINUTES = Number.isFinite(fromEnv) && process.env.NEXT_PUBLIC_BUSINESS_UTC_OFFSET_MINUTES !== undefined && process.env.NEXT_PUBLIC_BUSINESS_UTC_OFFSET_MINUTES !== ""
  ? fromEnv
  : 0

const OFFSET_MS = BUSINESS_UTC_OFFSET_MINUTES * 60_000

/** The same instant, moved so that its UTC fields read as Morocco wall-clock time. */
function shifted(d: Date): Date {
  return new Date(d.getTime() + OFFSET_MS)
}

export interface BusinessClock {
  year: number; month: number; day: number; hour: number; minute: number
}

/** Morocco wall-clock fields of an instant. */
export function businessClock(d: Date): BusinessClock {
  const s = shifted(d)
  return { year: s.getUTCFullYear(), month: s.getUTCMonth() + 1, day: s.getUTCDate(), hour: s.getUTCHours(), minute: s.getUTCMinutes() }
}

/** "YYYY-MM-DD" of an instant, in Morocco time. */
export function dayKey(d: Date): string {
  return shifted(d).toISOString().slice(0, 10)
}

/** "YYYY-MM" of an instant, in Morocco time. */
export function monthKey(d: Date): string {
  return dayKey(d).slice(0, 7)
}

/** Morocco wall-clock time -> the real instant. */
function zonedToUtc(y: number, m: number, d: number, h: number, mi: number, s: number, ms: number): Date {
  return new Date(Date.UTC(y, m - 1, d, h, mi, s, ms) - OFFSET_MS)
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
 * The most recent moment the clock showed `hour`:00 in Morocco (today's if it has passed, otherwise
 * yesterday's). Used for daily cut-offs such as the automatic closing of the till at 4 o'clock.
 */
export function lastDailyCutoff(hour: number, now: Date = new Date()): Date {
  const c = businessClock(now)
  const today = zonedToUtc(c.year, c.month, c.day, hour, 0, 0, 0)
  return today.getTime() <= now.getTime() ? today : new Date(today.getTime() - 86_400_000)
}

/**
 * A calendar date picked by the user (rental pickup / return / event, expense date): "YYYY-MM-DD"
 * stored at 12:00 UTC of that day. It is a DAY, not an instant, so it must show the same day on
 * every device whatever clock that device believes in.
 */
export function calendarDate(input: string): Date {
  const m = DATE_ONLY.exec(input.slice(0, 10))
  if (!m) return new Date(input)
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0, 0))
}

/**
 * "YYYY-MM-DD" that is certainly not later than today in Morocco, even if a device clock is a
 * little off. Use it to refuse dates in the past without refusing "today" around midnight.
 */
export function earliestTodayKey(): string {
  return dayKey(new Date(Date.now() - 2 * 3_600_000))
}

/**
 * "YYYY-MM-DD" of a stored calendar date, read without any time-zone rule. The 2-hour nudge also
 * reads correctly the older rows that were stored at midnight (23:00 or 00:00 UTC) instead of noon.
 */
export function calendarKey(d: Date | string): string {
  const t = typeof d === "string" ? new Date(d) : d
  return new Date(t.getTime() + 2 * 3_600_000).toISOString().slice(0, 10)
}
