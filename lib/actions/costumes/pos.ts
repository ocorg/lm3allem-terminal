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
import { costumeDetail, stockText } from "@/lib/inventory/low-stock"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { D } from "@/lib/utils/money"
import { id, money, parseInput, requestId, settlementMethod } from "@/lib/validation"
import { defer } from "@/lib/utils/defer"
import { alertCostumeSale } from "@/lib/notifications/alerts"

// ── Shared lookup types (re-exported for costumes components) ──
export interface LookupItem {
  id:       string
  label_fr: string
  label_ar: string
}

export type LookupById = Record<string, { label_fr: string; label_ar: string }>

// ── Item shape for POS ─────────────────────────────────────────
export interface CostumeItemForPOS {
  id:              string
  sku:             string | null
  name_fr:         string
  name_ar:         string
  typeId:          string
  typeLabelFr:     string
  typeLabelAr:     string
  sizeId:          string | null
  colorId:         string | null
  stock:           number
  sellingPrice:    string
  minSellingPrice: string
  images:          string[]
}

// ── Sale input ─────────────────────────────────────────────────
export interface CostumeSaleItemInput {
  costumeItemId: string
  quantity:      number
  unitPrice:     number
}

export interface CreateCostumeSaleInput {
  requestId:       string
  caisseSessionId: string
  items:           CostumeSaleItemInput[]
  paymentMethod:   "cash" | "tpe" | "banque"
  totalAmount:     number
  overrideToken?:  string
}

const saleSchema = z.object({
  requestId,
  caisseSessionId: id,
  items: z.array(z.object({
    costumeItemId: id,
    quantity:      z.number().int().min(1).max(10_000),
    unitPrice:     money,
  })).min(1).max(200),
  paymentMethod: settlementMethod,
  totalAmount:   money,
  overrideToken: z.string().max(600).optional(),
})

// ── getItemsForPOS ─────────────────────────────────────────────
export async function getItemsForPOS(): Promise<{
  items:        CostumeItemForPOS[]
  costumeTypes: LookupItem[]
  lookupById:   LookupById
}> {
  await requireModule("costumes", "pos")

  const [rawItems, rawLookup] = await Promise.all([
    prisma.costumeItem.findMany({
      where:   { isActive: true, stock: { gt: 0 }, segment: "sale" },
      include: { costumeType: true },
      orderBy: { name_fr: "asc" },
    }),
    getActiveLookups(),
  ])

  const lookupById: LookupById = {}
  for (const lv of rawLookup) {
    lookupById[lv.id] = { label_fr: lv.label_fr, label_ar: lv.label_ar }
  }

  const items: CostumeItemForPOS[] = rawItems.map((i) => ({
    id:              i.id,
    sku:             i.sku,
    name_fr:         i.name_fr,
    name_ar:         i.name_ar,
    typeId:          i.typeId,
    typeLabelFr:     i.costumeType.label_fr,
    typeLabelAr:     i.costumeType.label_ar,
    sizeId:          i.sizeId,
    colorId:         i.colorId,
    stock:           i.stock,
    sellingPrice:    i.sellingPrice.toString(),
    minSellingPrice: i.minSellingPrice.toString(),
    images:          i.images,
  }))

  const costumeTypes = rawLookup
    .filter((lv) => lv.category.slug === "costume_item_types")
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  return { items, costumeTypes, lookupById }
}

// ── createCostumeSale ──────────────────────────────────────────
export async function createCostumeSale(
  rawInput: CreateCostumeSaleInput
): Promise<ActionResult<{ saleId: string }>> {
  return run(async () => {
    const user  = await requireModule("costumes", "pos")
    const input = parseInput(saleSchema, rawInput)

    const existing = await prisma.costumeSale.findUnique({
      where: { requestId: input.requestId }, select: { id: true, cashierId: true },
    })
    if (existing) {
      if (existing.cashierId !== user.id) throw new ActionError("validation")
      return { saleId: existing.id }
    }

    const overrideAdminId = verifyOverrideToken(input.overrideToken, user.id)

    let saleId: string
    let soldIds: string[]
    let total: Prisma.Decimal

    try {
      const created = await prisma.$transaction(async (tx) => {
        await assertOpenSession(tx, input.caisseSessionId, "costumes")

        const wanted = new Map<string, number>()
        for (const item of input.items) wanted.set(item.costumeItemId, (wanted.get(item.costumeItemId) ?? 0) + item.quantity)

        const items = await tx.costumeItem.findMany({ where: { id: { in: [...wanted.keys()] } } })
        if (items.length !== wanted.size) throw new ActionError("not_found")
        const byId = new Map(items.map((i) => [i.id, i]))

        let sum = D(0)
        const lines = input.items.map((item) => {
          const dbItem = byId.get(item.costumeItemId)!
          if (!dbItem.isActive || dbItem.segment !== "sale") throw new ActionError("item_unavailable")

          const belowMin = D(item.unitPrice).lessThan(dbItem.minSellingPrice)
          if (belowMin && !overrideAdminId) throw new ActionError("below_min_not_authorized")

          sum = sum.plus(D(item.unitPrice).times(item.quantity))
          return {
            costumeItemId:  item.costumeItemId,
            quantity:       item.quantity,
            unitPrice:      item.unitPrice,
            wasBelowMin:    belowMin,
            authorizedById: belowMin ? overrideAdminId : null,
          }
        })

        if (D(input.totalAmount).minus(sum).abs().greaterThan("0.01")) throw new ActionError("total_mismatch")

        for (const [itemId, quantity] of wanted) {
          const res = await tx.costumeItem.updateMany({
            where: { id: itemId, stock: { gte: quantity } },
            data:  { stock: { decrement: quantity } },
          })
          if (res.count !== 1) throw new ActionError("insufficient_stock")
        }

        const sale = await tx.costumeSale.create({
          data: {
            requestId:       input.requestId,
            cashierId:       user.id,
            caisseSessionId: input.caisseSessionId,
            totalAmount:     sum,
            paymentMethod:   input.paymentMethod,
            items:           { create: lines },
          },
        })
        return { saleId: sale.id, ids: [...wanted.keys()], total: sum }
      })
      saleId = created.saleId
      soldIds = created.ids
      total = created.total
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const winner = await prisma.costumeSale.findUnique({ where: { requestId: input.requestId }, select: { id: true } })
        if (winner) return { saleId: winner.id }
      }
      throw err
    }

    await logActivity({
      portal: "costumes", entityType: "costume_sale", entityId: saleId, actor: user,
      action: "costume_sale.created",
      diff: {
        totalAmount:   total.toNumber(),
        itemCount:     input.items.length,
        paymentMethod: input.paymentMethod,
        ...(overrideAdminId ? { overrideBy: overrideAdminId } : {}),
      },
    })

    // Owner alerts (sale under the minimum price, unusually large sale)
    await alertCostumeSale(saleId, user)

    // Low-stock check: runs after the answer is sent, the cashier does not wait for it
    await defer(async () => {
      const lowItems = await prisma.costumeItem.findMany({
        where:   { id: { in: soldIds }, stock: { lte: 2 } },
        include: {
          size:      { select: { label_ar: true } },
          pantsSize: { select: { label_ar: true } },
          shirtSize: { select: { label_ar: true } },
          shoeSize:  { select: { label_ar: true } },
        },
      })
      for (const item of lowItems) {
        await createNotification({
          title:  item.stock <= 0 ? "نفد المخزون: بيعت آخر قطعة" : "مخزون منخفض",
          body:   `${item.name_ar}${costumeDetail(item) ? ` | ${costumeDetail(item)}` : ""} | ${item.stock <= 0 ? "نفد" : `المتبقي ${stockText(item.stock)}`}`,
          type:   "low_stock",
          portal: "costumes",
          actor:  user,
        })
      }
    })

    return { saleId }
  })
}
