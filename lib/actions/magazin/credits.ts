"use server"

import { prisma }       from "@/lib/db/prisma"
import { auth }         from "@/lib/auth/auth"
import { logActivity }  from "@/lib/activity/logger"
import type { PaymentMethod } from "@prisma/client"

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
  const credits = await prisma.credit.findMany({
    include: {
      payments: {
        include: { recordedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
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
      recordedByName: p.recordedBy.name,
      createdAt:      p.createdAt.toISOString(),
    })),
  }))
}

// ── addCreditPayment ───────────────────────────────
export async function addCreditPayment(
  creditId: string,
  amount:   number,
  method:   PaymentMethod
): Promise<void> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")

  const credit = await prisma.credit.findUniqueOrThrow({
    where:  { id: creditId },
    select: { balance: true, amountPaid: true },
  })

  const newBalance    = Math.round((Math.max(0, Number(credit.balance) - amount)) * 100) / 100
  const newAmountPaid = Math.round((Number(credit.amountPaid) + amount) * 100) / 100
  const newStatus     = newBalance <= 0
    ? "settled"
    : newAmountPaid > 0
    ? "partial"
    : "open"

  await prisma.$transaction(async (tx) => {
    await tx.creditPayment.create({
      data: {
        creditId,
        amount,
        method,
        recordedById: authSession.user.id,
      },
    })
    await tx.credit.update({
      where: { id: creditId },
      data:  { amountPaid: newAmountPaid, balance: newBalance, status: newStatus },
    })
  })

  await logActivity({
    portal:     "magazin",
    entityType: "credit",
    entityId:   creditId,
    actorId:    authSession.user.id,
    action:     "credit.payment_added",
    diff:       { amount, method, newBalance, status: newStatus },
  })
}