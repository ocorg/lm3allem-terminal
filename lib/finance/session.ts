import type { Portal, Prisma, PrismaClient } from "@prisma/client"
import { ActionError } from "@/lib/actions/result"
import { isStaleSession } from "@/lib/finance/auto-close"

type Db = Prisma.TransactionClient | PrismaClient

/**
 * A payment may only be attached to a session that is still open AND belongs to the portal
 * performing the operation. The session id comes from the browser, so it is never trusted.
 */
export async function assertOpenSession(db: Db, sessionId: string, portal: Portal): Promise<void> {
  const session = await db.caisseSession.findUnique({
    where:  { id: sessionId },
    select: { portal: true, closedAt: true, openedAt: true },
  })
  // a till left open from a previous working day no longer accepts money (the 4 o'clock rule)
  if (!session || session.portal !== portal || session.closedAt !== null || isStaleSession(session.openedAt)) {
    throw new ActionError("caisse_closed")
  }
}
