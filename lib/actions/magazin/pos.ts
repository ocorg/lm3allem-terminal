"use server"

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { getActiveLookups } from "@/lib/queries/lookups"
import { prisma } from "@/lib/db/prisma"
import { requireModule } from "@/lib/auth/guard"
import { verifyOverrideToken } from "@/lib/auth/override"
import { logActivity } from "@/lib/activity/logger"
import { createNotification } from "@/lib/notifications/create"
import { assertOpenSession } from "@/lib/finance/session"
import { stockText, variantDetail } from "@/lib/inventory/low-stock"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { D } from "@/lib/utils/money"
import { id, money, optionalText, paymentMethod, parseInput, requestId } from "@/lib/validation"
import { defer } from "@/lib/utils/defer"
import { alertShopSale } from "@/lib/notifications/alerts"

// ── Shared lookup shape ────────────────────────────
export interface LookupItem {
  id:       string
  label_fr: string
  label_ar: string
}

export type LookupById = Record<string, { label_fr: string; label_ar: string }>

// ── Product shape for POS ──────────────────────────
export interface VariantForPOS {
  id:      string
  sizeId:  string | null
  colorId: string | null
  stock:   number
}

export interface ProductForPOS {
  id:              string
  name_fr:         string
  name_ar:         string
  categoryId:      string
  sellingPrice:    string
  minSellingPrice: string
  images:          string[]
  variants:        VariantForPOS[]
}

// ── Sale input ─────────────────────────────────────
// The browser only says WHAT was sold and at WHICH price. "Below minimum" is decided on the server
// from the product record, and authorisation comes from a signed manager-override token.
export interface SaleItemInput {
  variantId: string
  quantity:  number
  unitPrice: number
}

export interface CreateSaleInput {
  /** idempotency key: a retried request returns the first sale instead of creating a duplicate */
  requestId:       string
  caisseSessionId: string
  items:           SaleItemInput[]
  paymentMethod:   "cash" | "tpe" | "banque" | "credit"
  totalAmount:     number
  /** amount handed over by the customer (for non-credit sales: >= total; for credit: the advance) */
  amountPaid:      number
  clientName?:     string
  clientPhone?:    string
  overrideToken?:  string
}

const saleSchema = z.object({
  requestId,
  caisseSessionId: id,
  items: z.array(z.object({
    variantId: id,
    quantity:  z.number().int().min(1).max(10_000),
    unitPrice: money,
  })).min(1).max(200),
  paymentMethod,
  totalAmount:   money,
  amountPaid:    money,
  clientName:    optionalText(120),
  clientPhone:   optionalText(30),
  overrideToken: z.string().max(600).optional(),
})

// ── getProductsForPOS ──────────────────────────────
export interface LookupEntry {
  id:       string
  label_fr: string
  label_ar: string
  slug:     string
}

export async function getProductsForPOS(): Promise<{
  products:   ProductForPOS[]
  categories: LookupItem[]
  lookupById: LookupById
}> {
  await requireModule("magazin", "pos")

  const [rawProducts, rawLookup] = await Promise.all([
    prisma.product.findMany({
      where:   { isActive: true },
      select: {
        id:              true,
        name_fr:         true,
        name_ar:         true,
        categoryId:      true,
        sellingPrice:    true,
        minSellingPrice: true,
        images:          true,
        variants:        {
          select: { id: true, sizeId: true, colorId: true, stock: true },
        },
      },
      orderBy: { name_fr: "asc" },
    }),
    getActiveLookups(),
  ])

  const categories: LookupItem[] = rawLookup
    .filter((lv) => lv.category.slug === "product_categories")
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  const lookupById: LookupById = {}
  for (const lv of rawLookup) {
    lookupById[lv.id] = { label_fr: lv.label_fr, label_ar: lv.label_ar }
  }

  const products: ProductForPOS[] = rawProducts.map((p) => ({
    ...p,
    sellingPrice:    p.sellingPrice.toString(),
    minSellingPrice: p.minSellingPrice.toString(),
  }))

  return { products, categories, lookupById }
}

// ── createSale ─────────────────────────────────────
export async function createSale(
  rawInput: CreateSaleInput
): Promise<ActionResult<{ saleId: string }>> {
  return run(async () => {
    const user  = await requireModule("magazin", "pos")
    const input = parseInput(saleSchema, rawInput)
    const isCredit = input.paymentMethod === "credit"

    // Idempotency: same request id from the same cashier returns the original sale.
    const existing = await prisma.sale.findUnique({
      where: { requestId: input.requestId }, select: { id: true, cashierId: true },
    })
    if (existing) {
      if (existing.cashierId !== user.id) throw new ActionError("validation")
      return { saleId: existing.id }
    }

    const overrideAdminId = verifyOverrideToken(input.overrideToken, user.id)

    let saleId: string
    let soldVariantIds: string[]
    let totalAmount: Prisma.Decimal

    try {
      const created = await prisma.$transaction(async (tx) => {
        await assertOpenSession(tx, input.caisseSessionId, "magazin")

        // Merge duplicate variants so the stock check sees the real quantity
        const wanted = new Map<string, number>()
        for (const item of input.items) wanted.set(item.variantId, (wanted.get(item.variantId) ?? 0) + item.quantity)

        const variants = await tx.productVariant.findMany({
          where:   { id: { in: [...wanted.keys()] } },
          include: { product: { select: { isActive: true, minSellingPrice: true } } },
        })
        if (variants.length !== wanted.size) throw new ActionError("not_found")
        const byId = new Map(variants.map((v) => [v.id, v]))

        let total = D(0)
        const lines = input.items.map((item) => {
          const variant = byId.get(item.variantId)!
          if (!variant.product.isActive) throw new ActionError("not_found")

          const belowMin = D(item.unitPrice).lessThan(variant.product.minSellingPrice)
          if (belowMin && !overrideAdminId) throw new ActionError("below_min_not_authorized")

          total = total.plus(D(item.unitPrice).times(item.quantity))
          return {
            variantId:      item.variantId,
            quantity:       item.quantity,
            unitPrice:      item.unitPrice,
            wasBelowMin:    belowMin,
            authorizedById: belowMin ? overrideAdminId : null,
          }
        })

        if (D(input.totalAmount).minus(total).abs().greaterThan("0.01")) throw new ActionError("total_mismatch")

        // Money actually kept by the shop: the customer may hand over more than the total (change).
        let amountPaid: Prisma.Decimal
        if (isCredit) {
          if (!input.clientName?.trim()) throw new ActionError("validation", "اسم العميل مطلوب للبيع بالآجل")
          if (D(input.amountPaid).greaterThanOrEqualTo(total)) throw new ActionError("invalid_amount")
          amountPaid = D(input.amountPaid)
        } else {
          if (D(input.amountPaid).lessThan(total)) throw new ActionError("invalid_amount")
          amountPaid = total
        }

        // Atomic stock decrement: the WHERE guard makes overselling impossible under concurrency.
        for (const [variantId, quantity] of wanted) {
          const res = await tx.productVariant.updateMany({
            where: { id: variantId, stock: { gte: quantity } },
            data:  { stock: { decrement: quantity } },
          })
          if (res.count !== 1) throw new ActionError("insufficient_stock")
        }

        const sale = await tx.sale.create({
          data: {
            requestId:       input.requestId,
            cashierId:       user.id,
            caisseSessionId: input.caisseSessionId,
            totalAmount:     total,
            amountPaid,
            paymentMethod:   input.paymentMethod,
            isCredit,
            items: { create: lines },
          },
        })

        if (isCredit) {
          const balance = total.minus(amountPaid)
          await tx.credit.create({
            data: {
              saleId:      sale.id,
              clientName:  input.clientName!.trim(),
              clientPhone: input.clientPhone?.trim() || null,
              totalAmount: total,
              amountPaid,
              balance,
              status:      amountPaid.greaterThan(0) ? "partial" : "open",
            },
          })
        }

        return { saleId: sale.id, variantIds: [...wanted.keys()], total }
      })
      saleId = created.saleId
      soldVariantIds = created.variantIds
      totalAmount = created.total
    } catch (err) {
      // Two simultaneous submissions of the same request: the loser returns the winner's sale.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const winner = await prisma.sale.findUnique({ where: { requestId: input.requestId }, select: { id: true } })
        if (winner) return { saleId: winner.id }
      }
      throw err
    }

    await logActivity({
      portal: "magazin", entityType: "sale", entityId: saleId, actor: user,
      action: "sale.created",
      diff: {
        totalAmount:   totalAmount.toNumber(),
        amountPaid:    input.paymentMethod === "credit" ? input.amountPaid : totalAmount.toNumber(),
        itemCount:     input.items.length,
        isCredit,
        paymentMethod: input.paymentMethod,
        ...(overrideAdminId ? { overrideBy: overrideAdminId } : {}),
      },
    })

    // Owner alerts (sale under the minimum price, unusually large sale or debt)
    await alertShopSale(saleId, user)

    // Low-stock check: runs after the answer is sent, the cashier does not wait for it
    await defer(async () => {
      const lowVariants = await prisma.productVariant.findMany({
        where:   { id: { in: soldVariantIds }, stock: { lte: 2 } },
        include: {
          product: { select: { name_ar: true } },
          size:    { select: { label_ar: true } },
          color:   { select: { label_ar: true } },
        },
      })
      for (const v of lowVariants) {
        await createNotification({
          title:  v.stock <= 0 ? "نفد المخزون: بيعت آخر قطعة" : "مخزون منخفض",
          body:   `${v.product.name_ar}${variantDetail(v) ? ` | ${variantDetail(v)}` : ""} | ${v.stock <= 0 ? "نفد" : `المتبقي ${stockText(v.stock)}`}`,
          type:   "low_stock",
          portal: "magazin",
          actor:  user,
        })
      }
    })

    return { saleId }
  })
}
