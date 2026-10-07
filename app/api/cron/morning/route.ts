import { NextRequest, NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/cron/auth"
import { createNotification } from "@/lib/notifications/create"
import { isTableRenderingAvailable, renderTablePng } from "@/lib/notifications/table-image"
import { sendTelegram, sendTelegramPhoto } from "@/lib/notifications/telegram"
import { getOverdueRentals } from "@/lib/rentals/overdue"
import { monthlyReport, morningBrief, weeklyReport } from "@/lib/reports/reports"
import { businessClock } from "@/lib/utils/time"

/**
 * Every morning (10:00, Morocco time): the owner's brief on Telegram.
 *   - every day: what leaves and comes back today, late returns, reminders, tills, low stock;
 *   - on Mondays: the summary of the last seven days;
 *   - on the 1st: the results of the month that just ended (as a table picture when possible).
 * Overdue rentals are also added to the in-app bell, one entry each.
 */
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const sent: Record<string, boolean> = {}

  for (const r of await getOverdueRentals()) {
    await createNotification({
      title:    "إيجار متأخر",
      body:     `${r.reference} | ${r.clientName} | أيام التأخير: ${r.daysOverdue}`,
      type:     "rental",
      portal:   "costumes",
      telegram: false, // the brief below already lists them: no flood in the group
    })
  }

  sent.brief = await sendTelegram(await morningBrief(now))

  // getUTCDay of a date built from the business clock: 1 = Monday
  const c = businessClock(now)
  if (new Date(Date.UTC(c.year, c.month - 1, c.day)).getUTCDay() === 1) sent.weekly = await sendTelegram(await weeklyReport(now))

  if (c.day === 1) {
    const month = await monthlyReport(now)
    let pictured = false
    if (isTableRenderingAvailable()) {
      try { pictured = await sendTelegramPhoto(await renderTablePng(month.table), month.table.title) } catch { pictured = false }
    }
    sent.monthly = pictured || await sendTelegram(month.text)
  }

  return NextResponse.json({ sent })
}
