"use server"

import { Prisma } from "@prisma/client"
import type { Portal } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { findActiveSession, type SerializedCaisseSession } from "@/lib/queries/caisse-session"
import { requireAdmin, requireModule, requirePortal } from "@/lib/auth/guard"
import { logActivity } from "@/lib/activity/logger"
import { createNotification } from "@/lib/notifications/create"
import { computeCaisseTotals } from "@/lib/finance/caisse"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { isValidMoney } from "@/lib/utils/money"
import { portalLabel } from "@/lib/utils/labels"
import { formatMAD } from "@/lib/utils/currency"
import { asId } from "@/lib/validation"

// ── Serialisable session shape ─────────────────────
// Decimal and Date fields are converted to primitives
// before crossing the server → client component boundary.
export type { SerializedCaisseSession } from "@/lib/queries/caisse-session"

const CASH_PORTALS: Portal[] = ["magazin", "costumes"]

// ── getActiveSession ───────────────────────────────
export async function getActiveSession(
  portal: Portal
): Promise<SerializedCaisseSession | null> {
  await requirePortal(portal)
  return findActiveSession(portal)
}

// ── openCaisseSession ──────────────────────────────
export async function openCaisseSession(
  portal:        Portal,
  openingAmount: number
): Promise<ActionResult<{ sessionId: string }>> {
  return run(async () => {
    const user = await requireAdmin()
    if (!CASH_PORTALS.includes(portal)) throw new ActionError("validation")
    if (!isValidMoney(openingAmount)) throw new ActionError("invalid_amount")

    let created
    try {
      // A partial unique index guarantees one open session per portal even under concurrency.
      created = await prisma.caisseSession.create({
        data: { portal, openedById: user.id, openingAmount },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ActionError("caisse_already_open")
      }
      throw err
    }

    await logActivity({
      portal, entityType: "caisse", entityId: created.id, actor: user,
      action: "caisse.opened", diff: { openingAmount },
    })
    await createNotification({
      title:  "فتح الصندوق",
      body:   `${portalLabel(portal)} | رصيد الافتتاح: ${formatMAD(openingAmount)}`,
      type:   "caisse_open",
      portal,
      actor:  user,
    })

    return { sessionId: created.id }
  })
}

// ── closeCaisseSession ─────────────────────────────
//
// expected CASH in the drawer (see lib/finance/caisse.ts for the exact rules):
//   opening + cash sales + cash rental payments/deposits + cash credit repayments
//           - cash deposits refunded + signed manual entries
// Card and bank-transfer money is never part of the drawer.
export async function closeCaisseSession(
  sessionId:     string,
  closingAmount: number
): Promise<ActionResult<{ expectedAmount: number; difference: number }>> {
  return run(async () => {
    const user = await requireAdmin()
    if (!isValidMoney(closingAmount)) throw new ActionError("invalid_amount")

    const session = await prisma.caisseSession.findUnique({
      where:  { id: sessionId },
      select: { id: true, portal: true, closedAt: true },
    })
    if (!session) throw new ActionError("not_found")
    if (session.closedAt) throw new ActionError("caisse_closed")

    const totals = await computeCaisseTotals(session.id, session.portal)

    // updateMany with closedAt:null makes the close idempotent under double-clicks
    const res = await prisma.caisseSession.updateMany({
      where: { id: session.id, closedAt: null },
      data:  {
        closingAmount,
        expectedAmount: totals.expectedCash,
        closedAt:       new Date(),
        closedById:     user.id,
      },
    })
    if (res.count === 0) throw new ActionError("caisse_closed")

    await logActivity({
      portal: session.portal, entityType: "caisse", entityId: session.id, actor: user,
      action: "caisse.closed", diff: { closingAmount, expectedAmount: totals.expectedCash },
    })
    await createNotification({
      title:  "إغلاق الصندوق",
      body:   `${portalLabel(session.portal)} | المبلغ المعدود: ${formatMAD(closingAmount)}`,
      type:   "caisse_close",
      portal: session.portal,
      actor:  user,
    })

    return {
      expectedAmount: totals.expectedCash,
      difference:     Math.round((closingAmount - totals.expectedCash) * 100) / 100,
    }
  })
}

// ── addManualEntry ─────────────────────────────────
// Signed amount: positive = cash added to the drawer, negative = cash taken out.
// Works for both cash portals: the portal comes from the SESSION, never from the browser.
export async function addManualEntry(
  sessionId: string,
  amount:    number,
  reason:    string
): Promise<ActionResult> {
  sessionId = asId(sessionId)
  return run(async () => {
    if (typeof reason !== "string") throw new ActionError("validation")
    const trimmed = reason.trim()
    if (!trimmed || trimmed.length > 200) throw new ActionError("validation")
    if (!isValidMoney(amount, { min: -100_000_000 }) || amount === 0) throw new ActionError("invalid_amount")

    const session = await prisma.caisseSession.findUnique({
      where:  { id: sessionId },
      select: { id: true, portal: true, closedAt: true },
    })
    if (!session || session.closedAt) throw new ActionError("caisse_closed")
    if (!CASH_PORTALS.includes(session.portal)) throw new ActionError("validation")

    const user = await requireModule(session.portal, "caisse")

    await prisma.caisseManualEntry.create({
      data: { sessionId: session.id, amount, reason: trimmed, recordedById: user.id },
    })

    await logActivity({
      portal: session.portal, entityType: "caisse", entityId: session.id, actor: user,
      action: "caisse.manual_entry", diff: { amount, reason: trimmed },
    })
  })
}
