import { timingSafeEqual } from "node:crypto"
import type { NextRequest } from "next/server"

/**
 * Scheduled jobs are protected by CRON_SECRET (Vercel Cron sends it automatically):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/<job>
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(req.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}
