import { NextRequest, NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/cron/auth"
import { sendTelegram } from "@/lib/notifications/telegram"
import { dayReport } from "@/lib/reports/reports"

/** Every evening (22:00, Morocco time): the day's sales, rental money, expenses and tills. */
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ sent: await sendTelegram(await dayReport()) })
}
