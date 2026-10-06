import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { autoCloseStaleSessions } from "@/lib/finance/auto-close"

/**
 * Daily job (4 o'clock, Morocco time): closes every till that was not closed by hand.
 * The same rule is also applied the moment anyone opens a till screen, so a missed run of this
 * job never leaves yesterday's till open for today's sales.
 *
 * Protected by CRON_SECRET (Vercel Cron sends the header automatically when it is set).
 */
export const dynamic = "force-dynamic"

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(req.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const closed = await autoCloseStaleSessions()
  return NextResponse.json({ closed })
}
