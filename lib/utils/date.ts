import { format, formatDistance, isValid } from "date-fns"
import { fr, arMA } from "date-fns/locale"
import type { Language } from "@prisma/client"

function toDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null
  const date = typeof d === "string" ? new Date(d) : d
  return isValid(date) ? date : null
}

function locale(lang: Language) {
  return lang === "ar" ? arMA : fr
}

export function formatDate(
  date: Date | string | null | undefined,
  pattern = "dd/MM/yyyy",
  lang: Language = "ar"
): string {
  const d = toDate(date)
  return d ? format(d, pattern, { locale: locale(lang) }) : "-"
}

export function formatDateTime(
  date: Date | string | null | undefined,
  lang: Language = "ar"
): string {
  return formatDate(date, "dd/MM/yyyy HH:mm", lang)
}

export function formatRelative(
  date: Date | string | null | undefined,
  lang: Language = "ar"
): string {
  const d = toDate(date)
  if (!d) return "-"
  return formatDistance(d, new Date(), { addSuffix: true, locale: locale(lang) })
}

export function getDaysOverdue(returnDate: Date | string): number {
  const d = toDate(returnDate)
  if (!d) return 0
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000))
}