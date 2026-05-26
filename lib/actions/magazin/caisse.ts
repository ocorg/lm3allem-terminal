"use server"

import { prisma }       from "@/lib/db/prisma"
import { auth }         from "@/lib/auth/auth"
import { logActivity }  from "@/lib/activity/logger"

// ── Shapes ─────────────────────────────────────────
export interface TransactionEntry {
  type:       "sale" | "manual"
  id:         string
  amount:     string
  label:      string
  method?:    string
  actorName:  string
  createdAt:  string
}

export interface SessionStats {
  sessionId:    string
  openingAmount: string
  totalSales:   number
  totalManual:  number
  runningTotal: number
  salesCount:   number
  transactions: TransactionEntry[]
}

// ── getSessionStats ────────────────────────────────
export async function getSessionStats(
  sessionId: string
): Promise<SessionStats> {
  const session = await prisma.caisseSession.findUniqueOrThrow({
    where:   { id: sessionId },
    include: {
      sales: {
        select: {
          id:            true,
          amountPaid:    true,
          paymentMethod: true,
          createdAt:     true,
          cashier:       { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      manualEntries: {
        select: {
          id:         true,
          amount:     true,
          reason:     true,
          createdAt:  true,
          recordedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  const totalSales  = session.sales.reduce((s, x) => s + Number(x.amountPaid), 0)
  const totalManual = session.manualEntries.reduce((s, x) => s + Number(x.amount), 0)
  const runningTotal = Number(session.openingAmount) + totalSales + totalManual

  const transactions: TransactionEntry[] = [
    ...session.sales.map((s) => ({
      type:      "sale"  as const,
      id:        s.id,
      amount:    s.amountPaid.toString(),
      label:     "Vente",
      method:    s.paymentMethod,
      actorName: s.cashier.name,
      createdAt: s.createdAt.toISOString(),
    })),
    ...session.manualEntries.map((e) => ({
      type:      "manual" as const,
      id:        e.id,
      amount:    e.amount.toString(),
      label:     e.reason,
      actorName: e.recordedBy.name,
      createdAt: e.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
   .slice(0, 40)

  return {
    sessionId,
    openingAmount: session.openingAmount.toString(),
    totalSales,
    totalManual,
    runningTotal,
    salesCount: session.sales.length,
    transactions,
  }
}

// ── addManualEntry ─────────────────────────────────
export async function addManualEntry(
  sessionId: string,
  amount:    number,
  reason:    string
): Promise<void> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")

  await prisma.caisseManualEntry.create({
    data: {
      sessionId,
      amount,
      reason,
      recordedById: authSession.user.id,
    },
  })

  await logActivity({
    portal:     "magazin",
    entityType: "caisse",
    entityId:   sessionId,
    actorId:    authSession.user.id,
    action:     "caisse.manual_entry",
    diff:       { amount, reason },
  })
}