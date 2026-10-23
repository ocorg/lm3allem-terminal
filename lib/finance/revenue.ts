import { prisma } from "@/lib/db/prisma"
import { D, toNum } from "@/lib/utils/money"
import type { TransactionType } from "@prisma/client"

/**
 * What counts as revenue (cash basis: money actually collected):
 *   magazin  = sale.amountPaid (cash received at the till, advances included)  + credit repayments
 *   costumes = costume sale totals + rental payments of type rental_payment / remaining_balance
 *
 * Refunds of a cancelled rental (rental_refund) are subtracted from rental revenue.
 * Shop returns subtract the money they gave back (refundAmount), on the day of the return, whatever
 * the refund method: "none" (a corrected sale whose money never came in) cancels revenue that was
 * counted but never received. The part of a return that only reduced a debt was never revenue.
 * They are kept as their own rows (magazinReturns) so screens can show them, not hide them.
 *
 * NOT revenue: refundable rental deposits (deposit_collected / deposit_returned), the unpaid part of
 * a credit sale (it becomes revenue when the customer repays) and caisse manual entries.
 */
export const RENTAL_REVENUE_TYPES: TransactionType[] = ["rental_payment", "remaining_balance"]

export interface DateWindow { from: Date; to: Date }

export interface RevenueRow { amount: number; at: Date }

export interface RevenueRows {
  /** shop sales and debt repayments (gross, returns NOT subtracted) */
  magazin:  RevenueRow[]
  /** shop returns: money given back, as POSITIVE amounts (subtract them from magazin) */
  magazinReturns: RevenueRow[]
  costumes: RevenueRow[]
  rentals:  RevenueRow[]
}

/** Row-level data for a window (used to bucket by Morocco day / month). */
export async function getRevenueRows(window: DateWindow): Promise<RevenueRows> {
  const range = { gte: window.from, lte: window.to }
  const [sales, creditPayments, returns, costumeSales, rentalPayments] = await Promise.all([
    prisma.sale.findMany({ where: { createdAt: range }, select: { amountPaid: true, createdAt: true } }),
    prisma.creditPayment.findMany({ where: { createdAt: range }, select: { amount: true, createdAt: true } }),
    prisma.saleReturn.findMany({ where: { createdAt: range, refundAmount: { gt: 0 } }, select: { refundAmount: true, createdAt: true } }),
    prisma.costumeSale.findMany({ where: { createdAt: range }, select: { totalAmount: true, createdAt: true } }),
    prisma.rentalPayment.findMany({
      where:  { createdAt: range, type: { in: [...RENTAL_REVENUE_TYPES, "rental_refund"] } },
      select: { amount: true, type: true, createdAt: true },
    }),
  ])

  return {
    magazin: [
      ...sales.map((s) => ({ amount: toNum(s.amountPaid), at: s.createdAt })),
      ...creditPayments.map((p) => ({ amount: toNum(p.amount), at: p.createdAt })),
    ],
    magazinReturns: returns.map((r) => ({ amount: toNum(r.refundAmount), at: r.createdAt })),
    costumes: costumeSales.map((s) => ({ amount: toNum(s.totalAmount), at: s.createdAt })),
    // refunds of cancelled rentals reduce revenue
    rentals:  rentalPayments.map((p) => ({
      amount: p.type === "rental_refund" ? -toNum(p.amount) : toNum(p.amount),
      at:     p.createdAt,
    })),
  }
}

/** All-time totals via SQL aggregates (dashboard headline numbers). `magazin` is NET of returns; `magazinReturns` is shown on its own. */
export async function getRevenueTotals(): Promise<{ magazin: number; magazinReturns: number; costumes: number; rentals: number }> {
  const [sales, credits, shopReturns, costumeSales, rentals, refunds] = await Promise.all([
    prisma.sale.aggregate({ _sum: { amountPaid: true } }),
    prisma.creditPayment.aggregate({ _sum: { amount: true } }),
    prisma.saleReturn.aggregate({ _sum: { refundAmount: true } }),
    prisma.costumeSale.aggregate({ _sum: { totalAmount: true } }),
    prisma.rentalPayment.aggregate({
      where: { type: { in: RENTAL_REVENUE_TYPES } },
      _sum:  { amount: true },
    }),
    prisma.rentalPayment.aggregate({
      where: { type: "rental_refund" },
      _sum:  { amount: true },
    }),
  ])
  return {
    magazin:  toNum(D(sales._sum.amountPaid).plus(D(credits._sum.amount)).minus(D(shopReturns._sum.refundAmount))),
    magazinReturns: toNum(shopReturns._sum.refundAmount),
    costumes: toNum(costumeSales._sum.totalAmount),
    rentals:  toNum(D(rentals._sum.amount).minus(D(refunds._sum.amount))),
  }
}
