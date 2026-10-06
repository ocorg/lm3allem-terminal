import { formatDistance, isValid } from "date-fns"
import { fr, arMA } from "date-fns/locale"
import type { Language } from "@prisma/client"
import { BUSINESS_TZ, calendarKey } from "@/lib/utils/time"

function toDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null
  const date = typeof d === "string" ? new Date(d) : d
  return isValid(date) ? date : null
}

function locale(lang: Language) {
  return lang === "ar" ? arMA : fr
}

// Dates are always shown in Morocco time with plain digits, built from parts so the text is
// identical on the server (UTC on the host) and in the browser. Never use toLocaleString here.
const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
})

function parts(d: Date): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of partsFmt.formatToParts(d)) out[p.type] = p.value
  return out
}

/** "03/08/2026" */
export function formatDate(date: Date | string | null | undefined): string {
  const d = toDate(date)
  if (!d) return "-"
  const p = parts(d)
  return `${p.day}/${p.month}/${p.year}`
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
  const p = parts(d)
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

export function formatRelative(
  date: Date | string | null | undefined,
  lang: Language = "ar"
): string {
  const d = toDate(date)
  if (!d) return "-"
  return formatDistance(d, new Date(), { addSuffix: true, locale: locale(lang) })
}
