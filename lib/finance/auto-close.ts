import type { Portal } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { computeCaisseTotals } from "@/lib/finance/caisse"
import { createNotification } from "@/lib/notifications/create"
import { formatMAD } from "@/lib/utils/currency"
import { formatDateTime } from "@/lib/utils/date"
import { portalLabel } from "@/lib/utils/labels"
import { lastDailyCutoff } from "@/lib/utils/time"

/** The till of a working day is closed automatically at this hour (Morocco time) if nobody closed it. */
export const AUTO_CLOSE_HOUR = 4

/** A session opened before the last 4 o'clock belongs to a finished working day. */
export function isStaleSession(openedAt: Date, now: Date = new Date()): boolean {
  return openedAt.getTime() < lastDailyCutoff(AUTO_CLOSE_HOUR, now).getTime()
}

/**
 * Closes one forgotten session.
 *   - nobody counted the drawer, so the counted amount stays EMPTY (no fake "difference 0");
 *   - the expected cash is recorded, so the admin can still compare it with the drawer later;
 *   - no user closed it: closedById stays empty, which the history shows as an automatic closing.
 * Safe to call twice: only a still-open session is changed.
 */
export async function autoCloseSession(session: { id: string; portal: Portal; openedAt: Date }): Promise<boolean> {
  const totals = await computeCaisseTotals(session.id, session.portal)

  const res = await prisma.caisseSession.updateMany({
    where: { id: session.id, closedAt: null },
    data:  { expectedAmount: totals.expectedCash, closedAt: new Date() },
  })
  if (res.count === 0) return false

  await createNotification({
    title:  "إغلاق تلقائي للصندوق",
    body:   `${portalLabel(session.portal)} | فُتح في ${formatDateTime(session.openedAt)} ولم يُغلق يدويا | النقد المتوقع: ${formatMAD(totals.expectedCash)} | لم يُسجَّل المبلغ المعدود`,
    type:   "caisse_close",
    portal: session.portal,
  })
  return true
}

/** Closes every session left open from a previous working day. Returns how many were closed. */
export async function autoCloseStaleSessions(now: Date = new Date()): Promise<number> {
  const stale = await prisma.caisseSession.findMany({
    where:  { closedAt: null, openedAt: { lt: lastDailyCutoff(AUTO_CLOSE_HOUR, now) } },
    select: { id: true, portal: true, openedAt: true },
  })
  let closed = 0
  for (const session of stale) if (await autoCloseSession(session)) closed++
  return closed
}
