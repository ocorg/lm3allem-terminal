"use server"

import { prisma } from "@/lib/db/prisma"
import { requireModule } from "@/lib/auth/guard"
import { computeCaisseTotals } from "@/lib/finance/caisse"
import { ActionError } from "@/lib/actions/result"
import { actorLabel } from "@/lib/utils/actor"
import { asId } from "@/lib/validation"

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
  /** cash from direct sales */
  totalSales:    number
  /** cash from rental payments and deposits, net of cash paid back */
  totalRentals:  number
  totalManual:   number
  /** card + bank transfers: NOT in the drawer */
  nonCash:       number
  /** expected CASH in the drawer */
  runningTotal:  number
  salesCount:    number
  rentalsCount:  number
  transactions:  TransactionEntry[]
}

const RENTAL_LABELS: Record<string, string> = {
  rental_payment:    "دفعة إيجار",
  remaining_balance: "تسوية الرصيد",
  deposit_collected: "ضمان مستلم",
  deposit_returned:  "ضمان مُرجَع",
  rental_refund:     "استرجاع إيجار ملغى",
}

const OUTFLOW_TYPES = new Set(["deposit_returned", "rental_refund"])

// ── getCostumesSessionStats ────────────────────────────────────
export async function getCostumesSessionStats(
  sessionId: string
): Promise<CostumesSessionStats> {
  sessionId = asId(sessionId)
  await requireModule("costumes", "caisse")

  const session = await prisma.caisseSession.findUnique({
    where:  { id: sessionId },
    select: { id: true, portal: true },
  })
  if (!session || session.portal !== "costumes") throw new ActionError("not_found")

  const [totals, sales, rentalPayments, manualEntries] = await Promise.all([
    computeCaisseTotals(sessionId, "costumes"),
    prisma.costumeSale.findMany({
      where:   { caisseSessionId: sessionId },
      select:  {
        id: true, totalAmount: true, paymentMethod: true, createdAt: true,
        cashier: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take:    40,
    }),
    prisma.rentalPayment.findMany({
      where:   { caisseSessionId: sessionId },
      select:  {
        id: true, amount: true, method: true, type: true, createdAt: true,
        recordedBy: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take:    40,
    }),
    prisma.caisseManualEntry.findMany({
      where:   { sessionId },
      select:  {
        id: true, amount: true, reason: true, createdAt: true,
        recordedBy: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take:    40,
    }),
  ])

  const transactions: TransactionEntry[] = [
    ...sales.map((x) => ({
      type:      "costume_sale" as const,
      id:        x.id,
      amount:    x.totalAmount.toString(),
      label:     "بيع بدلة",
      method:    x.paymentMethod,
      actorName: actorLabel(x.cashier),
      createdAt: x.createdAt.toISOString(),
    })),
    ...rentalPayments.map((x) => ({
      type:      "rental_payment" as const,
      id:        x.id,
      // Negative string for money paid back so the UI can render it as an outflow
      amount:    OUTFLOW_TYPES.has(x.type) ? `-${x.amount}` : x.amount.toString(),
      label:     RENTAL_LABELS[x.type] ?? x.type,
      method:    x.method,
      actorName: actorLabel(x.recordedBy),
      createdAt: x.createdAt.toISOString(),
    })),
    ...manualEntries.map((x) => ({
      type:      "manual" as const,
      id:        x.id,
      amount:    x.amount.toString(),
      label:     x.reason,
      actorName: actorLabel(x.recordedBy),
      createdAt: x.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 60)

  return {
    sessionId,
    openingAmount: totals.openingAmount.toString(),
    totalSales:    totals.lines.sales,
    totalRentals:  Math.round((totals.lines.rentalPayments + totals.lines.deposits - totals.cashOut) * 100) / 100,
    totalManual:   totals.manual,
    nonCash:       totals.nonCash,
    runningTotal:  totals.expectedCash,
    salesCount:    totals.salesCount,
    rentalsCount:  rentalPayments.length,
    transactions,
  }
}
