"use server"

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { requireModule } from "@/lib/auth/guard"
import { returnScope, verifyOverrideToken } from "@/lib/auth/override"
import { logActivity } from "@/lib/activity/logger"
import { assertOpenSession } from "@/lib/finance/session"
import { computeCaisseTotals } from "@/lib/finance/caisse"
import { variantDetail } from "@/lib/inventory/low-stock"
import { alertShopReturn } from "@/lib/notifications/alerts"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { isAdminRole } from "@/lib/permissions"
import { getReturnWindowDays } from "@/lib/returns/policy"
import { isWithinReturnWindow, returnDeadline, saleMoneyMethod } from "@/lib/returns/window"
import { actorLabel } from "@/lib/utils/actor"
import { D, toNum } from "@/lib/utils/money"
import { endOfDay, startOfDay } from "@/lib/utils/time"
import { asId, id, parseInput, requestId, settlementMethod } from "@/lib/validation"

/**
 * Shop sales history and returns.
 *
 * A return never edits the original sale: it is its own record (SaleReturn), attached to the till
 * open at that moment, so the till, the debts, the revenue and the reports all see it for what it
 * is. Staff need an admin's approval for every return; after the return period only an admin
 * (logged in as themself) can do it.
 */

// ── Shapes ─────────────────────────────────────────

export type SaleReturnState = "none" | "partial" | "full"

export interface SaleListRow {
  id:            string
  createdAt:     string
  cashierName:   string
  paymentMethod: string
  totalAmount:   number
  clientName:    string | null
  summary:       string
  pieces:        number
  returnedPieces: number
  returnedValue: number
  returnState:   SaleReturnState
}

export interface SalesListResult {
  rows:       SaleListRow[]
  total:      number
  page:       number
  pageSize:   number
  windowDays: number
}

export interface SaleDetailItem {
  id:               string
  label:            string
  quantity:         number
  returnedQuantity: number
  unitPrice:        number
}

export interface SaleReturnRecord {
  id:             string
  createdAt:      string
  kind:           string
  reason:         string
  totalValue:     number
  refundAmount:   number
  refundMethod:   string
  debtReduction:  number
  afterDeadline:  boolean
  processedByName: string
  authorizedByName: string
  items: { label: string; quantity: number; unitPrice: number; restocked: boolean }[]
}

export interface SaleDetail {
  id:            string
  createdAt:     string
  cashierName:   string
  paymentMethod: string
  totalAmount:   number
  amountPaid:    number
  items:         SaleDetailItem[]
  credit:        { clientName: string; clientPhone: string | null; balance: number } | null
  returns:       SaleReturnRecord[]
  windowDays:    number
  deadline:      string
  withinWindow:  boolean
  /** the sale was made in the till that is open right now */
  inOpenTill:    boolean
  tillOpen:      boolean
  /** cash the open till should hold now (a cash refund cannot exceed it) */
  drawerCash:    number | null
  /** how the sale's money came in (cash for a credit sale's advance) */
  moneyMethod:   "cash" | "tpe" | "banque"
}

const ITEM_INCLUDE = {
  variant: {
    include: {
      product: { select: { name_ar: true } },
      size:    { select: { label_ar: true } },
      color:   { select: { label_ar: true } },
    },
  },
} as const

type ItemWithVariant = Prisma.SaleItemGetPayload<{ include: typeof ITEM_INCLUDE }>
const itemLabel = (i: ItemWithVariant) => [i.variant.product.name_ar, variantDetail(i.variant)].filter(Boolean).join(" | ")

function returnState(items: { quantity: number; returnedQuantity: number }[]): SaleReturnState {
  const returned = items.reduce((s, i) => s + i.returnedQuantity, 0)
  if (returned === 0) return "none"
  return items.every((i) => i.returnedQuantity >= i.quantity) ? "full" : "partial"
}

// ── getSalesList ───────────────────────────────────

export interface SalesListFilters {
  /** "YYYY-MM-DD" (Morocco time) */
  from?:     string
  to?:       string
  /** product or customer name */
  q?:        string
  returned?: boolean
  page?:     number
}

const PAGE_SIZE = 25
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

const listSchema = z.object({
  from:     z.string().regex(DAY_KEY).optional(),
  to:       z.string().regex(DAY_KEY).optional(),
  q:        z.string().trim().max(80).optional(),
  returned: z.boolean().optional(),
  page:     z.number().int().min(1).max(10_000).optional(),
})

export async function getSalesList(rawFilters: SalesListFilters = {}): Promise<SalesListResult> {
  await requireModule("magazin", "pos")
  const filters = parseInput(listSchema, rawFilters)
  const page = filters.page ?? 1

  const where: Prisma.SaleWhereInput = {}
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: startOfDay(filters.from) } : {}),
      ...(filters.to ? { lte: endOfDay(filters.to) } : {}),
    }
  }
  if (filters.returned) where.returns = { some: {} }
  if (filters.q) {
    const contains = { contains: filters.q, mode: "insensitive" as const }
    where.OR = [
      { items: { some: { variant: { product: { OR: [{ name_ar: contains }, { name_fr: contains }] } } } } },
      { credit: { OR: [{ clientName: contains }, { clientPhone: contains }] } },
    ]
  }

  const [sales, total, windowDays] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * PAGE_SIZE,
      take:    PAGE_SIZE,
      include: {
        cashier: { select: { name: true, role: true } },
        credit:  { select: { clientName: true } },
        items:   { include: ITEM_INCLUDE },
        returns: { select: { totalValue: true } },
      },
    }),
    prisma.sale.count({ where }),
    getReturnWindowDays(),
  ])

  return {
    rows: sales.map((s) => {
      const labels = s.items.map((i) => `${itemLabel(i)}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`)
      return {
        id:             s.id,
        createdAt:      s.createdAt.toISOString(),
        cashierName:    actorLabel(s.cashier),
        paymentMethod:  s.paymentMethod,
        totalAmount:    toNum(s.totalAmount),
        clientName:     s.credit?.clientName ?? null,
        summary:        labels.slice(0, 3).join("، ") + (labels.length > 3 ? ` و${labels.length - 3} أخرى` : ""),
        pieces:         s.items.reduce((n, i) => n + i.quantity, 0),
        returnedPieces: s.items.reduce((n, i) => n + i.returnedQuantity, 0),
        returnedValue:  toNum(s.returns.reduce((v, r) => v.plus(r.totalValue), D(0))),
        returnState:    returnState(s.items),
      }
    }),
    total,
    page,
    pageSize: PAGE_SIZE,
    windowDays,
  }
}

// ── getSaleDetail ──────────────────────────────────

export async function getSaleDetail(saleId: string): Promise<ActionResult<SaleDetail>> {
  return run(async () => {
    saleId = asId(saleId)
    await requireModule("magazin", "pos")

    const [sale, openTill, windowDays] = await Promise.all([
      prisma.sale.findUnique({
        where:   { id: saleId },
        include: {
          cashier: { select: { name: true, role: true } },
          credit:  { select: { clientName: true, clientPhone: true, balance: true } },
          items:   { include: ITEM_INCLUDE, orderBy: { id: "asc" } },
          returns: {
            orderBy: { createdAt: "desc" },
            include: {
              processedBy:  { select: { name: true, role: true } },
              authorizedBy: { select: { name: true, role: true } },
              items:        { include: { saleItem: { include: ITEM_INCLUDE } } },
            },
          },
        },
      }),
      prisma.caisseSession.findFirst({ where: { portal: "magazin", closedAt: null }, select: { id: true } }),
      getReturnWindowDays(),
    ])
    if (!sale) throw new ActionError("not_found")
    const drawer = openTill ? await computeCaisseTotals(openTill.id, "magazin") : null

    return {
      id:            sale.id,
      createdAt:     sale.createdAt.toISOString(),
      cashierName:   actorLabel(sale.cashier),
      paymentMethod: sale.paymentMethod,
      totalAmount:   toNum(sale.totalAmount),
      amountPaid:    toNum(sale.amountPaid),
      items: sale.items.map((i) => ({
        id:               i.id,
        label:            itemLabel(i),
        quantity:         i.quantity,
        returnedQuantity: i.returnedQuantity,
        unitPrice:        toNum(i.unitPrice),
      })),
      credit: sale.credit
        ? { clientName: sale.credit.clientName, clientPhone: sale.credit.clientPhone, balance: toNum(sale.credit.balance) }
        : null,
      returns: sale.returns.map((r) => ({
        id:               r.id,
        createdAt:        r.createdAt.toISOString(),
        kind:             r.kind,
        reason:           r.reason,
        totalValue:       toNum(r.totalValue),
        refundAmount:     toNum(r.refundAmount),
        refundMethod:     r.refundMethod,
        debtReduction:    toNum(r.debtReduction),
        afterDeadline:    r.afterDeadline,
        processedByName:  actorLabel(r.processedBy),
        authorizedByName: actorLabel(r.authorizedBy),
        items: r.items.map((i) => ({
          label:     itemLabel(i.saleItem),
          quantity:  i.quantity,
          unitPrice: toNum(i.unitPrice),
          restocked: i.restocked,
        })),
      })),
      windowDays,
      deadline:     returnDeadline(sale.createdAt, windowDays).toISOString(),
      withinWindow: isWithinReturnWindow(sale.createdAt, windowDays),
      inOpenTill:   openTill?.id === sale.caisseSessionId,
      tillOpen:     !!openTill,
      drawerCash:   drawer?.expectedCash ?? null,
      moneyMethod:  saleMoneyMethod(sale.paymentMethod),
    }
  })
}

// ── createSaleReturn ───────────────────────────────

export interface CreateSaleReturnInput {
  /** idempotency key: a retried request returns the first return instead of a second one */
  requestId:     string
  saleId:        string
  kind:          "customer_return" | "entry_error"
  reason:        string
  /** how the money goes back for a customer return (ignored for a correction: decided by the server) */
  refundMethod?: "cash" | "tpe" | "banque"
  items:         { saleItemId: string; quantity: number; restock: boolean }[]
  /** admin approval for staff (scope: this sale) */
  overrideToken?: string
}

const returnSchema = z.object({
  requestId,
  saleId:       id,
  kind:         z.enum(["customer_return", "entry_error"]),
  reason:       z.string().trim().min(2).max(300),
  refundMethod: settlementMethod.optional(),
  items: z.array(z.object({
    saleItemId: id,
    quantity:   z.number().int().min(1).max(10_000),
    restock:    z.boolean(),
  })).min(1).max(200)
    .refine((items) => new Set(items.map((i) => i.saleItemId)).size === items.length),
  overrideToken: z.string().max(600).optional(),
})

export async function createSaleReturn(
  rawInput: CreateSaleReturnInput
): Promise<ActionResult<{ returnId: string }>> {
  return run(async () => {
    const user  = await requireModule("magazin", "pos")
    const input = parseInput(returnSchema, rawInput)

    // Idempotency: the same request from the same person returns the first return
    const existing = await prisma.saleReturn.findUnique({
      where: { requestId: input.requestId }, select: { id: true, processedById: true },
    })
    if (existing) {
      if (existing.processedById !== user.id) throw new ActionError("validation")
      return { returnId: existing.id }
    }

    const [sale, windowDays, session] = await Promise.all([
      prisma.sale.findUnique({
        where:  { id: input.saleId },
        select: { id: true, createdAt: true, caisseSessionId: true, paymentMethod: true },
      }),
      getReturnWindowDays(),
      prisma.caisseSession.findFirst({ where: { portal: "magazin", closedAt: null }, select: { id: true } }),
    ])
    if (!sale) throw new ActionError("not_found")

    // Who may do it: an admin directly; staff only with an admin's approval for THIS sale,
    // and only during the return period.
    const isAdmin = isAdminRole(user.role)
    const withinWindow = isWithinReturnWindow(sale.createdAt, windowDays)
    if (!withinWindow && !isAdmin) throw new ActionError("return_window_expired")
    const approverId = isAdmin ? user.id : verifyOverrideToken(input.overrideToken, user.id, returnScope(sale.id))
    if (!approverId) throw new ActionError("return_not_authorized")

    if (!session) throw new ActionError("caisse_closed")

    if (input.kind === "customer_return" && !input.refundMethod) throw new ActionError("validation")

    // Cash the drawer should hold right now (a cash refund cannot exceed it)
    const drawer = await computeCaisseTotals(session.id, "magazin")

    let created: { returnId: string }
    try {
      created = await prisma.$transaction(async (tx) => {
        await assertOpenSession(tx, session.id, "magazin")

        const saleItems = await tx.saleItem.findMany({
          where:  { saleId: sale.id, id: { in: input.items.map((i) => i.saleItemId) } },
          select: { id: true, variantId: true, quantity: true, unitPrice: true },
        })
        if (saleItems.length !== input.items.length) throw new ActionError("not_found")
        const byId = new Map(saleItems.map((i) => [i.id, i]))

        let value = D(0)
        for (const line of input.items) {
          const item = byId.get(line.saleItemId)!
          // Guarded update: never more pieces back than were sold, even with two returns at once
          const res = await tx.saleItem.updateMany({
            where: { id: item.id, returnedQuantity: { lte: item.quantity - line.quantity } },
            data:  { returnedQuantity: { increment: line.quantity } },
          })
          if (res.count !== 1) throw new ActionError("return_quantity")

          if (line.restock) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data:  { stock: { increment: line.quantity } },
            })
          }
          value = value.plus(D(item.unitPrice).times(line.quantity))
        }

        // A credit sale: the returned value first cancels what the customer still owes
        let debtReduction = D(0)
        let refund = value
        const credit = await tx.credit.findUnique({
          where:  { saleId: sale.id },
          select: { id: true, totalAmount: true, amountPaid: true, balance: true },
        })
        if (credit) {
          debtReduction = Prisma.Decimal.min(value, Prisma.Decimal.max(credit.balance, 0))
          refund = value.minus(debtReduction)
          const newBalance = D(credit.balance).minus(debtReduction)
          const newPaid = D(credit.amountPaid).minus(refund)
          // Guarded on the values read above: a payment recorded meanwhile makes this retry
          const res = await tx.credit.updateMany({
            where: { id: credit.id, balance: credit.balance, amountPaid: credit.amountPaid },
            data:  {
              totalAmount: D(credit.totalAmount).minus(value),
              amountPaid:  newPaid,
              balance:     newBalance,
              status:      newBalance.lessThanOrEqualTo(0) ? "settled" : newPaid.greaterThan(0) ? "partial" : "open",
            },
          })
          if (res.count !== 1) throw new ActionError("changed_meanwhile")
        }

        // How the money goes back
        let refundMethod: "cash" | "tpe" | "banque" | "none"
        if (refund.lessThanOrEqualTo(0)) {
          refundMethod = "none"
        } else if (input.kind === "entry_error") {
          // A mistaken sale: if its till is still open, its money is taken back out of that till's
          // figures; if that till is closed, nothing physical moves (the money never came in).
          refundMethod = sale.caisseSessionId === session.id ? saleMoneyMethod(sale.paymentMethod) : "none"
        } else {
          refundMethod = input.refundMethod!
        }
        if (refundMethod === "cash" && refund.greaterThan(drawer.expectedCash)) {
          throw new ActionError("return_not_enough_cash")
        }

        const saleReturn = await tx.saleReturn.create({
          data: {
            requestId:       input.requestId,
            saleId:          sale.id,
            caisseSessionId: session.id,
            kind:            input.kind,
            reason:          input.reason,
            totalValue:      value,
            refundAmount:    refund,
            refundMethod,
            debtReduction,
            afterDeadline:   !withinWindow,
            processedById:   user.id,
            authorizedById:  approverId,
            items: {
              create: input.items.map((line) => ({
                saleItemId: line.saleItemId,
                quantity:   line.quantity,
                unitPrice:  byId.get(line.saleItemId)!.unitPrice,
                restocked:  line.restock,
              })),
            },
          },
        })
        return { returnId: saleReturn.id }
      })
    } catch (err) {
      // Two simultaneous submissions of the same request: the second returns the first one's result
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const winner = await prisma.saleReturn.findUnique({ where: { requestId: input.requestId }, select: { id: true } })
        if (winner) return { returnId: winner.id }
      }
      throw err
    }

    const saved = await prisma.saleReturn.findUniqueOrThrow({
      where:  { id: created.returnId },
      select: { totalValue: true, refundAmount: true, refundMethod: true, debtReduction: true },
    })
    await logActivity({
      portal: "magazin", entityType: "sale_return", entityId: created.returnId, actor: user,
      action: input.kind === "entry_error" ? "sale.corrected" : "sale.returned",
      diff: {
        saleId:        sale.id,
        totalValue:    toNum(saved.totalValue),
        refundAmount:  toNum(saved.refundAmount),
        refundMethod:  saved.refundMethod,
        debtReduction: toNum(saved.debtReduction),
        pieces:        input.items.reduce((n, i) => n + i.quantity, 0),
        damaged:       input.items.filter((i) => !i.restock).reduce((n, i) => n + i.quantity, 0),
        reason:        input.reason,
        authorizedBy:  approverId,
        afterDeadline: !withinWindow,
      },
    })
    await alertShopReturn(created.returnId, user)

    return created
  })
}
