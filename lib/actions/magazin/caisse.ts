"use server"

import { prisma } from "@/lib/db/prisma"
import { requireModule } from "@/lib/auth/guard"
import { computeCaisseTotals } from "@/lib/finance/caisse"
import { ActionError } from "@/lib/actions/result"
import { actorLabel } from "@/lib/utils/actor"
import { asId } from "@/lib/validation"
import { returnKindLabel } from "@/lib/utils/labels"
import { formatMAD } from "@/lib/utils/currency"

// ── Shapes ─────────────────────────────────────────
export interface TransactionEntry {
  type:       "sale" | "credit_payment" | "manual" | "return"
  id:         string
  amount:     string
  label:      string
  /** extra line under the label (e.g. a debt reduced by a return) */
  note?:      string
  /** for returns: "none" = no money moved */
  method?:    string
  actorName:  string
  createdAt:  string
}

export interface SessionStats {
  sessionId:      string
  openingAmount:  string
  /** cash received from sales (advances included) */
  totalSales:     number
  /** cash received from credit repayments */
  creditPayments: number
  /** cash handed back for returns */
  returnsCash:    number
  returnsCount:   number
  totalManual:    number
  /** card + bank transfers: NOT in the drawer */
  nonCash:        number
  /** expected CASH in the drawer */
  runningTotal:   number
  salesCount:     number
  transactions:   TransactionEntry[]
}

// ── getSessionStats ────────────────────────────────
export async function getSessionStats(
  sessionId: string
): Promise<SessionStats> {
  sessionId = asId(sessionId)
  await requireModule("magazin", "caisse")

  const session = await prisma.caisseSession.findUnique({
    where:  { id: sessionId },
    select: { id: true, portal: true },
  })
  if (!session || session.portal !== "magazin") throw new ActionError("not_found")

  const [totals, sales, creditPayments, manualEntries, returns] = await Promise.all([
    computeCaisseTotals(sessionId, "magazin"),
    prisma.sale.findMany({
      where:   { caisseSessionId: sessionId },
      select:  {
        id: true, amountPaid: true, paymentMethod: true, createdAt: true,
        cashier: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take:    40,
    }),
    prisma.creditPayment.findMany({
      where:   { caisseSessionId: sessionId },
      select:  {
        id: true, amount: true, method: true, createdAt: true,
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
    prisma.saleReturn.findMany({
      where:   { caisseSessionId: sessionId },
      select:  {
        id: true, kind: true, reason: true, refundAmount: true, refundMethod: true, debtReduction: true, createdAt: true,
        processedBy: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take:    40,
    }),
  ])

  const transactions: TransactionEntry[] = [
    ...sales.map((s) => ({
      type:      "sale" as const,
      id:        s.id,
      amount:    s.amountPaid.toString(),
      label:     "بيع",
      method:    s.paymentMethod,
      actorName: actorLabel(s.cashier),
      createdAt: s.createdAt.toISOString(),
    })),
    ...creditPayments.map((p) => ({
      type:      "credit_payment" as const,
      id:        p.id,
      amount:    p.amount.toString(),
      label:     "أداء دين",
      method:    p.method,
      actorName: actorLabel(p.recordedBy),
      createdAt: p.createdAt.toISOString(),
    })),
    // returns are their own lines: money going OUT (negative), or nothing when no money moved
    ...returns.map((r) => ({
      type:      "return" as const,
      id:        r.id,
      amount:    r.refundAmount.negated().toString(),
      label:     `${returnKindLabel(r.kind)}: ${r.reason}`,
      note:      r.debtReduction.greaterThan(0) ? `خُصم من الدين ${formatMAD(r.debtReduction)}` : undefined,
      method:    r.refundMethod,
      actorName: actorLabel(r.processedBy),
      createdAt: r.createdAt.toISOString(),
    })),
    ...manualEntries.map((e) => ({
      type:      "manual" as const,
      id:        e.id,
      amount:    e.amount.toString(),
      label:     e.reason,
      actorName: actorLabel(e.recordedBy),
      createdAt: e.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 40)

  return {
    sessionId,
    openingAmount:  totals.openingAmount.toString(),
    totalSales:     totals.lines.sales,
    creditPayments: totals.lines.creditPayments,
    returnsCash:    totals.lines.returnsCash,
    returnsCount:   totals.returnsCount,
    totalManual:    totals.manual,
    nonCash:        totals.nonCash,
    runningTotal:   totals.expectedCash,
    salesCount:     totals.salesCount,
    transactions,
  }
}
