"use server"

import { prisma }      from "@/lib/db/prisma"
import { auth }        from "@/lib/auth/auth"
import { logActivity } from "@/lib/activity/logger"

// ── Shapes ─────────────────────────────────────────────────────
export interface TransactionEntry {
  type:      "costume_sale" | "rental_payment" | "manual"
  id:        string
  amount:    string
  label:     string
  method?:   string
  actorName: string
  createdAt: string
}

export interface CostumesSessionStats {
  sessionId:     string
  openingAmount: string
  totalSales:    number
  totalRentals:  number
  totalManual:   number
  runningTotal:  number
  salesCount:    number
  rentalsCount:  number
  transactions:  TransactionEntry[]
}

// ── getCostumesSessionStats ────────────────────────────────────
export async function getCostumesSessionStats(
  sessionId: string
): Promise<CostumesSessionStats> {
  const session = await prisma.caisseSession.findUniqueOrThrow({
    where:   { id: sessionId },
    include: {
      costumeSales: {
        select: {
          id:            true,
          totalAmount:   true,
          paymentMethod: true,
          createdAt:     true,
          cashier:       { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      rentalPayments: {
        select: {
          id:          true,
          amount:      true,
          method:      true,
          type:        true,
          createdAt:   true,
          recordedBy:  { select: { name: true } },
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

  const totalSales = session.costumeSales.reduce(
    (s, x) => s + Number(x.totalAmount), 0
  )

  const totalRentals = session.rentalPayments.reduce((s, rp) => {
    const amt = Number(rp.amount)
    return rp.type === "deposit_returned" ? s - amt : s + amt
  }, 0)

  const totalManual  = session.manualEntries.reduce(
    (s, x) => s + Number(x.amount), 0
  )

  const runningTotal =
    Number(session.openingAmount) + totalSales + totalRentals + totalManual

  const transactions: TransactionEntry[] = [
    ...session.costumeSales.map((x) => ({
      type:      "costume_sale" as const,
      id:        x.id,
      amount:    x.totalAmount.toString(),
      label:     "Vente costume",
      method:    x.paymentMethod,
      actorName: x.cashier.name,
      createdAt: x.createdAt.toISOString(),
    })),
    ...session.rentalPayments.map((x) => ({
      type:      "rental_payment" as const,
      id:        x.id,
      // Negative string for deposit_returned so the UI can render it as outflow
      amount:    x.type === "deposit_returned"
        ? `-${x.amount}`
        : x.amount.toString(),
      label:     `Location - ${x.type}`,
      method:    x.method,
      actorName: x.recordedBy.name,
      createdAt: x.createdAt.toISOString(),
    })),
    ...session.manualEntries.map((x) => ({
      type:      "manual" as const,
      id:        x.id,
      amount:    x.amount.toString(),
      label:     x.reason,
      actorName: x.recordedBy.name,
      createdAt: x.createdAt.toISOString(),
    })),
  ].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return {
    sessionId:     session.id,
    openingAmount: session.openingAmount.toString(),
    totalSales,
    totalRentals,
    totalManual,
    runningTotal,
    salesCount:    session.costumeSales.length,
    rentalsCount:  session.rentalPayments.length,
    transactions,
  }
}