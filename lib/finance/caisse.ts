import { prisma } from "@/lib/db/prisma"
import { D, toNum, type DecimalLike } from "@/lib/utils/money"
import type { Portal } from "@prisma/client"

/**
 * Cash-drawer arithmetic - ONE implementation shared by the live session screens and the closing
 * action, so "expected" can never disagree with what the screen showed.
 *
 * Rules:
 *   - only CASH moves the drawer: card (tpe) and bank transfers (banque) are reported separately;
 *   - a credit sale's advance is treated as cash;
 *   - credit repayments received in cash are included;
 *   - a refunded rental deposit / cancelled-rental refund paid back in cash is an outflow;
 *   - manual entries are signed (negative = money taken out).
 */

export interface CaisseTotals {
  openingAmount: number
  /** cash received (sales + rentals + credit repayments), before outflows */
  cashIn:        number
  /** cash paid out (refunded deposits) */
  cashOut:       number
  /** signed manual entries */
  manual:        number
  /** card + bank money, NOT in the drawer */
  nonCash:       number
  /** what should physically be in the drawer */
  expectedCash:  number
  salesCount:    number
  /** itemised cash lines, for the stat cards */
  lines: {
    sales:          number
    rentalPayments: number
    deposits:       number
    creditPayments: number
  }
}

const sum = (v: DecimalLike) => D(v)

export async function computeCaisseTotals(sessionId: string, portal: Portal): Promise<CaisseTotals> {
  const session = await prisma.caisseSession.findUniqueOrThrow({
    where:  { id: sessionId },
    select: { openingAmount: true },
  })
  const manualAgg = await prisma.caisseManualEntry.aggregate({
    where: { sessionId },
    _sum:  { amount: true },
  })
  const manual = sum(manualAgg._sum.amount)

  let salesCash = D(0), salesNonCash = D(0), salesCount = 0
  let rentalCash = D(0), depositCash = D(0), outflow = D(0), rentalNonCash = D(0)
  let creditCash = D(0), creditNonCash = D(0)

  if (portal === "magazin") {
    const [sales, credits] = await Promise.all([
      prisma.sale.groupBy({
        by: ["paymentMethod"], where: { caisseSessionId: sessionId },
        _sum: { amountPaid: true }, _count: { _all: true },
      }),
      prisma.creditPayment.groupBy({
        by: ["method"], where: { caisseSessionId: sessionId }, _sum: { amount: true },
      }),
    ])
    for (const row of sales) {
      salesCount += row._count._all
      const amount = sum(row._sum.amountPaid)
      // "credit" = credit sale: the advance was handed over in cash
      if (row.paymentMethod === "cash" || row.paymentMethod === "credit") salesCash = salesCash.plus(amount)
      else salesNonCash = salesNonCash.plus(amount)
    }
    for (const row of credits) {
      const amount = sum(row._sum.amount)
      if (row.method === "cash") creditCash = creditCash.plus(amount)
      else creditNonCash = creditNonCash.plus(amount)
    }
  } else if (portal === "costumes") {
    const [sales, rentals] = await Promise.all([
      prisma.costumeSale.groupBy({
        by: ["paymentMethod"], where: { caisseSessionId: sessionId },
        _sum: { totalAmount: true }, _count: { _all: true },
      }),
      prisma.rentalPayment.groupBy({
        by: ["method", "type"], where: { caisseSessionId: sessionId }, _sum: { amount: true },
      }),
    ])
    for (const row of sales) {
      salesCount += row._count._all
      const amount = sum(row._sum.totalAmount)
      if (row.paymentMethod === "cash") salesCash = salesCash.plus(amount)
      else salesNonCash = salesNonCash.plus(amount)
    }
    for (const row of rentals) {
      const amount = sum(row._sum.amount)
      if (row.type === "deposit_returned" || row.type === "rental_refund") {
        if (row.method === "cash") outflow = outflow.plus(amount)
        continue
      }
      if (row.method === "cash") {
        if (row.type === "deposit_collected") depositCash = depositCash.plus(amount)
        else rentalCash = rentalCash.plus(amount)
      } else {
        rentalNonCash = rentalNonCash.plus(amount)
      }
    }
  }

  const cashIn = salesCash.plus(rentalCash).plus(depositCash).plus(creditCash)
  const expected = D(session.openingAmount).plus(cashIn).minus(outflow).plus(manual)

  return {
    openingAmount: toNum(session.openingAmount),
    cashIn:        toNum(cashIn),
    cashOut:       toNum(outflow),
    manual:        toNum(manual),
    nonCash:       toNum(salesNonCash.plus(rentalNonCash).plus(creditNonCash)),
    expectedCash:  toNum(expected),
    salesCount,
    lines: {
      sales:          toNum(salesCash),
      rentalPayments: toNum(rentalCash),
      deposits:       toNum(depositCash),
      creditPayments: toNum(creditCash),
    },
  }
}
