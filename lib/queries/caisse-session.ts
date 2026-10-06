import { cache } from "react"
import type { Portal } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { autoCloseSession, isStaleSession } from "@/lib/finance/auto-close"

export interface SerializedCaisseSession {
  id:            string
  portal:        string
  openedById:    string
  openingAmount: string
  openedAt:      string
  closedAt:      string | null
  closedById:    string | null
}

/**
 * The open caisse session of a portal. Cached per request: the guard and the page both need it,
 * and now it costs ONE query instead of two.
 */
export const findActiveSession = cache(async (portal: Portal): Promise<SerializedCaisseSession | null> => {
  const session = await prisma.caisseSession.findFirst({
    where:   { portal, closedAt: null },
    orderBy: { openedAt: "desc" },
  })
  if (!session) return null

  // Left open from a previous working day: it is closed now (the 4 o'clock rule), and the shop
  // starts the day with a closed till that the admin opens again.
  if (isStaleSession(session.openedAt)) {
    await autoCloseSession(session)
    return null
  }

  return {
    id:            session.id,
    portal:        session.portal,
    openedById:    session.openedById,
    openingAmount: session.openingAmount.toString(),
    openedAt:      session.openedAt.toISOString(),
    closedAt:      session.closedAt?.toISOString() ?? null,
    closedById:    session.closedById ?? null,
  }
})
