import "server-only"
import { prisma } from "@/lib/db/prisma"
import { DEFAULT_RETURN_WINDOW_DAYS, MAX_RETURN_WINDOW_DAYS, MIN_RETURN_WINDOW_DAYS } from "@/lib/returns/window"

/**
 * The return period set by the admin (Settings screen). Read from the database every time, never
 * cached or copied, so a change applies at once to every screen and every check.
 */
export async function getReturnWindowDays(): Promise<number> {
  const settings = await prisma.systemSettings.findFirst({ select: { returnWindowDays: true } })
  const days = settings?.returnWindowDays ?? DEFAULT_RETURN_WINDOW_DAYS
  return Math.min(MAX_RETURN_WINDOW_DAYS, Math.max(MIN_RETURN_WINDOW_DAYS, days))
}
