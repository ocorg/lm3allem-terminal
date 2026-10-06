import { formatDistance, isValid } from "date-fns"
import { fr, arMA } from "date-fns/locale"
import type { Language } from "@prisma/client"
import { businessClock, calendarKey } from "@/lib/utils/time"

function toDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null
  const date = typeof d === "string" ? new Date(d) : d
  return isValid(date) ? date : null
}

function locale(lang: Language) {
  return lang === "ar" ? arMA : fr
}

// Dates are always shown in Morocco time with plain digits. They are computed from the business
// clock (lib/utils/time.ts), never from a time-zone database, so the server and every browser
// print exactly the same text.
const two = (n: number) => String(n).padStart(2, "0")

/** "03/08/2026" */
export function formatDate(date: Date | string | null | undefined): string {
  const d = toDate(date)
  if (!d) return "-"
  const c = businessClock(d)
  return `${two(c.day)}/${two(c.month)}/${c.year}`
}

/** A calendar date picked by the user (rental pickup / return / event, expense date): "07/10/2026". */
export function formatDay(date: Date | string | null | undefined): string {
  const d = toDate(date)
  if (!d) return "-"
  const [y, m, day] = calendarKey(d).split("-")
  return `${day}/${m}/${y}`
}

/** "03/08/2026 19:15" */
export function formatDateTime(date: Date | string | null | undefined): string {
  const d = toDate(date)
  if (!d) return "-"
  const c = businessClock(d)
  return `${two(c.day)}/${two(c.month)}/${c.year} ${two(c.hour)}:${two(c.minute)}`
}

export function formatRelative(
  date: Date | string | null | undefined,
  lang: Language = "ar"
): string {
  const d = toDate(date)
  if (!d) return "-"
  return formatDistance(d, new Date(), { addSuffix: true, locale: locale(lang) })
}
