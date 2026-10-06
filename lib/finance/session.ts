import type { Portal, Prisma, PrismaClient } from "@prisma/client"
import { ActionError } from "@/lib/actions/result"

type Db = Prisma.TransactionClient | PrismaClient

/**
 * A payment may only be attached to a session that is still open AND belongs to the portal
 * performing the operation. The session id comes from the browser, so it is never trusted.
 */
export async function assertOpenSession(db: Db, sessionId: string, portal: Portal): Promise<void> {
  const session = await db.caisseSession.findUnique({
    where:  { id: sessionId },
    select: { portal: true, closedAt: true },
  })
  if (!session || session.portal !== portal || session.closedAt !== null) {
    throw new ActionError("caisse_closed")
  }
}
