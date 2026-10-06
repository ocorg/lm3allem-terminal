"use server"

import { prisma } from "@/lib/db/prisma"
import { requireModule } from "@/lib/auth/guard"
import { logActivity } from "@/lib/activity/logger"
import { assertOpenSession } from "@/lib/finance/session"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { D } from "@/lib/utils/money"
import { actorLabel } from "@/lib/utils/actor"
import { id, moneyPositive, parseInput, settlementMethod } from "@/lib/validation"
import { z } from "zod"

// ── Shapes ─────────────────────────────────────────
export interface CreditPaymentRecord {
  id:              string
  amount:          string
  method:          string
  recordedByName:  string
  createdAt:       string
}

export interface CreditForList {
  id:          string
  clientName:  string
  clientPhone: string | null
  totalAmount: string
  amountPaid:  string
  balance:     string
  status:      string
  createdAt:   string
  payments:    CreditPaymentRecord[]
}

// ── getCredits ─────────────────────────────────────
export async function getCredits(): Promise<CreditForList[]> {
  await requireModule("magazin", "credits")

  const credits = await prisma.credit.findMany({
    include: {
      payments: {
        include: { recordedBy: { select: { name: true, role: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take:    1000,
  })

  return credits.map((c) => ({
    id:          c.id,
    clientName:  c.clientName,
    clientPhone: c.clientPhone,
    totalAmount: c.totalAmount.toString(),
    amountPaid:  c.amountPaid.toString(),
    balance:     c.balance.toString(),
    status:      c.status,
    createdAt:   c.createdAt.toISOString(),
    payments:    c.payments.map((p) => ({
      id:             p.id,
      amount:         p.amount.toString(),
      method:         p.method,
      recordedByName: actorLabel(p.recordedBy),
      createdAt:      p.createdAt.toISOString(),
    })),
  }))
}

const paymentSchema = z.object({
  creditId: id,
  amount:   moneyPositive,
  method:   settlementMethod,
})

// ── addCreditPayment ───────────────────────────────
// The payment is tied to the open magazin caisse session so cash repayments reach the drawer
// reconciliation. The balance update is a guarded atomic statement (no read-then-write race).
export async function addCreditPayment(
  creditId: string,
  amount:   number,
  method:   "cash" | "tpe" | "banque"
): Promise<ActionResult> {
  return run(async () => {
    const user  = await requireModule("magazin", "credits")
    const input = parseInput(paymentSchema, { creditId, amount, method })

    const session = await prisma.caisseSession.findFirst({
      where:  { portal: "magazin", closedAt: null },
      select: { id: true },
    })
    if (!session) throw new ActionError("caisse_closed")

    const newStatus = await prisma.$transaction(async (tx) => {
      await assertOpenSession(tx, session.id, "magazin")

      const credit = await tx.credit.findUnique({
        where:  { id: input.creditId },
        select: { balance: true, amountPaid: true },
      })
      if (!credit) throw new ActionError("not_found")
      if (D(credit.balance).lessThanOrEqualTo(0)) throw new ActionError("nothing_to_pay")
      if (D(input.amount).greaterThan(credit.balance)) throw new ActionError("amount_exceeds_balance")

      // Guarded update: only applies while the balance still covers the payment
      const updated = await tx.credit.updateMany({
        where: { id: input.creditId, balance: { gte: input.amount } },
        data:  { balance: { decrement: input.amount }, amountPaid: { increment: input.amount } },
      })
      if (updated.count !== 1) throw new ActionError("amount_exceeds_balance")

      const fresh = await tx.credit.findUniqueOrThrow({
        where: { id: input.creditId }, select: { balance: true },
      })
      const status = D(fresh.balance).lessThanOrEqualTo(0) ? "settled" : "partial"
      await tx.credit.update({ where: { id: input.creditId }, data: { status } })

      await tx.creditPayment.create({
        data: {
          creditId:        input.creditId,
          caisseSessionId: session.id,
          amount:          input.amount,
          method:          input.method,
          recordedById:    user.id,
        },
      })
      return status
    })

    await logActivity({
      portal: "magazin", entityType: "credit", entityId: input.creditId, actor: user,
      action: "credit.payment_added",
      diff:   { amount: input.amount, method: input.method, status: newStatus },
    })
  })
}
