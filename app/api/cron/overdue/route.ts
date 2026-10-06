import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { getOverdueRentals } from "@/lib/rentals/overdue"
import { createNotification } from "@/lib/notifications/create"
import { sendTelegram } from "@/lib/notifications/telegram"
import { formatDay } from "@/lib/utils/date"

/**
 * Daily job: tells the admin which rentals are overdue.
 *   - one entry per rental in the in-app notification bell;
 *   - ONE summary message on Telegram (not one per rental, to avoid a flood).
 *
 * Protected by CRON_SECRET. Schedule it with any cron service:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/overdue
 * (Vercel Cron sends this header automatically when CRON_SECRET is set.)
 */
export const dynamic = "force-dynamic"

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get("authorization") ?? ""
  const given = Buffer.from(header)
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const overdue = await getOverdueRentals()

  for (const r of overdue) {
    await createNotification({
      title:    "إيجار متأخر",
      body:     `${r.reference} - ${r.clientName} - ${r.daysOverdue} يوم`,
      type:     "rental",
      portal:   "costumes",
      telegram: false,
    })
  }

  let telegramSent = false
  if (overdue.length > 0) {
    const lines = overdue.map(
      (r) => `• ${r.reference} · ${r.clientName} (${r.clientPhone}) · كان الإرجاع ${formatDay(r.scheduledReturnDate)} · ${r.daysOverdue} يوم تأخير`
    )
    telegramSent = await sendTelegram(`⏰ إيجارات متأخرة (${overdue.length})\n\n${lines.join("\n")}`)
  }

  return NextResponse.json({ overdue: overdue.length, telegramSent })
}
