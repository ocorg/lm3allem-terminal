"use server"

import { prisma } from "@/lib/db/prisma"
import { auth }   from "@/lib/auth/auth"
import type { Portal } from "@prisma/client"

// ── Serialisable session shape ─────────────────────
// Decimal and Date fields are converted to primitives
// before crossing the server → client component boundary.
export interface SerializedCaisseSession {
  id:            string
  portal:        string
  openedById:    string
  openingAmount: string   // Prisma Decimal → string
  openedAt:      string   // Date            → ISO string
  closedAt:      string | null
  closedById:    string | null
}

// ── getActiveSession ───────────────────────────────
export async function getActiveSession(
  portal: Portal
): Promise<SerializedCaisseSession | null> {
  const session = await prisma.caisseSession.findFirst({
    where:   { portal, closedAt: null },
    orderBy: { openedAt: "desc" },
  })
  if (!session) return null

  return {
    id:            session.id,
    portal:        session.portal,
    openedById:    session.openedById,
    openingAmount: session.openingAmount.toString(),
    openedAt:      session.openedAt.toISOString(),
    closedAt:      session.closedAt?.toISOString() ?? null,
    closedById:    session.closedById ?? null,
  }
}

// ── openCaisseSession ──────────────────────────────
export async function openCaisseSession(
  portal:        Portal,
  openingAmount: number
): Promise<{ sessionId: string }> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")
  if (!["admin", "superadmin"].includes(authSession.user.role)) {
    throw new Error("Forbidden: admin role required")
  }

  const existing = await prisma.caisseSession.findFirst({
    where: { portal, closedAt: null },
  })
  if (existing) throw new Error("Session already open for this portal")

  const created = await prisma.caisseSession.create({
    data: {
      portal,
      openedById:    authSession.user.id,
      openingAmount,
    },
  })

  return { sessionId: created.id }
}

// ── closeCaisseSession ─────────────────────────────
//
// expectedAmount formula (per portal):
//
//   magazin:
//     openingAmount
//     + SUM(sales.amountPaid)          — cash actually received
//     + SUM(manualEntries.amount)      — positive = in, negative = out
//
//   costumes:
//     openingAmount
//     + SUM(costumeSales.totalAmount)
//     + SUM(rentalPayments.amount) where type ≠ deposit_returned
//     − SUM(rentalPayments.amount) where type = deposit_returned
//     + SUM(manualEntries.amount)
//
//   lm3allem (no POS):
//     openingAmount
//     + SUM(manualEntries.amount)
//
export async function closeCaisseSession(
  sessionId:     string,
  closingAmount: number
): Promise<void> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")
  if (!["admin", "superadmin"].includes(authSession.user.role)) {
    throw new Error("Forbidden: admin role required")
  }

  const session = await prisma.caisseSession.findUniqueOrThrow({
    where:   { id: sessionId, closedAt: null },
    include: {
      sales:         { select: { amountPaid:  true } },
      costumeSales:  { select: { totalAmount: true } },
      rentalPayments:{ select: { amount: true, type: true } },
      manualEntries: { select: { amount: true } },
    },
  })

  let expectedAmount = Number(session.openingAmount)

  if (session.portal === "magazin") {
    expectedAmount += session.sales.reduce(
      (sum, s) => sum + Number(s.amountPaid), 0
    )
  } else if (session.portal === "costumes") {
    expectedAmount += session.costumeSales.reduce(
      (sum, s) => sum + Number(s.totalAmount), 0
    )
    expectedAmount += session.rentalPayments.reduce((sum, rp) => {
      const amt = Number(rp.amount)
      return rp.type === "deposit_returned" ? sum - amt : sum + amt
    }, 0)
  }
  // All portals: manual entries (negative = expense/return/outflow)
  expectedAmount += session.manualEntries.reduce(
    (sum, e) => sum + Number(e.amount), 0
  )

  await prisma.caisseSession.update({
    where: { id: sessionId },
    data: {
      closingAmount,
      expectedAmount,
      closedAt:   new Date(),
      closedById: authSession.user.id,
    },
  })
}