"use server"

import { prisma }      from "@/lib/db/prisma"
import { auth }        from "@/lib/auth/auth"
import { logActivity }         from "@/lib/activity/logger"
import { createNotification }   from "@/lib/notifications/create"
import type { CostumeItemType, PaymentMethod } from "@prisma/client"

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
  name_fr:         string
  name_ar:         string
  type:            CostumeItemType
  sizeId:          string | null
  colorId:         string | null
  stock:           number
  sellingPrice:    string
  minSellingPrice: string
  images:          string[]
}

// ── Sale input ─────────────────────────────────────────────────
export interface CostumeSaleItemInput {
  costumeItemId:   string
  quantity:        number
  unitPrice:       number
  wasBelowMin:     boolean
  authorizedById?: string
}

export interface CreateCostumeSaleInput {
  caisseSessionId: string
  items:           CostumeSaleItemInput[]
  paymentMethod:   PaymentMethod
  totalAmount:     number
}

// ── getItemsForPOS ─────────────────────────────────────────────
export async function getItemsForPOS(): Promise<{
  items:     CostumeItemForPOS[]
  lookupById: LookupById
}> {
  const [rawItems, rawLookup] = await Promise.all([
    prisma.costumeItem.findMany({
      where:   { isActive: true, stock: { gt: 0 } },
      orderBy: { name_fr: "asc" },
    }),
    prisma.lookupValue.findMany({
      where:   { isActive: true },
      include: { category: { select: { slug: true } } },
      orderBy: { order: "asc" },
    }),
  ])

  const lookupById: LookupById = {}
  for (const lv of rawLookup) {
    lookupById[lv.id] = { label_fr: lv.label_fr, label_ar: lv.label_ar }
  }

  const items: CostumeItemForPOS[] = rawItems.map((i) => ({
    id:              i.id,
    name_fr:         i.name_fr,
    name_ar:         i.name_ar,
    type:            i.type,
    sizeId:          i.sizeId,
    colorId:         i.colorId,
    stock:           i.stock,
    sellingPrice:    i.sellingPrice.toString(),
    minSellingPrice: i.minSellingPrice.toString(),
    images:          i.images,
  }))

  return { items, lookupById }
}

// ── createCostumeSale ──────────────────────────────────────────
export async function createCostumeSale(
  input: CreateCostumeSaleInput
): Promise<{ saleId: string }> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")

  const cashierId = authSession.user.id

  const result = await prisma.$transaction(async (tx) => {
    // Stock check inside transaction
    for (const item of input.items) {
      const costumeItem = await tx.costumeItem.findUnique({
        where:  { id: item.costumeItemId },
        select: { stock: true },
      })
      if (!costumeItem) throw new Error(`Article introuvable: ${item.costumeItemId}`)
      if (costumeItem.stock < item.quantity) {
        throw new Error("Stock insuffisant pour un ou plusieurs articles")
      }
    }

    const sale = await tx.costumeSale.create({
      data: {
        cashierId,
        caisseSessionId: input.caisseSessionId,
        totalAmount:     input.totalAmount,
        paymentMethod:   input.paymentMethod,
        items: {
          create: input.items.map((item) => ({
            costumeItemId:  item.costumeItemId,
            quantity:       item.quantity,
            unitPrice:      item.unitPrice,
            wasBelowMin:    item.wasBelowMin,
            authorizedById: item.authorizedById ?? null,
          })),
        },
      },
    })

    for (const item of input.items) {
      await tx.costumeItem.update({
        where: { id: item.costumeItemId },
        data:  { stock: { decrement: item.quantity } },
      })
    }

    return sale
  })

  await logActivity({
    portal:     "costumes",
    entityType: "costume_sale",
    entityId:   result.id,
    actorId:    cashierId,
    action:     "costume_sale.created",
    diff: {
      totalAmount:   input.totalAmount,
      itemCount:     input.items.length,
      paymentMethod: input.paymentMethod,
    },
  })

  // Low-stock check after costume sale
  try {
    const soldItemIds = input.items.map((i: { itemId: string }) => i.itemId)
    const lowItems = await prisma.costumeItem.findMany({
      where: { id: { in: soldItemIds }, stock: { lte: 2 } },
      select: { name_fr: true, stock: true },
    })
    for (const item of lowItems) {
      await createNotification({
        title:  "Stock bas",
        body:   `${item.name_fr} — Stock restant: ${item.stock}`,
        type:   "low_stock",
        portal: "costumes",
      })
    }
  } catch { /* non-critical */ }

  return { saleId: result.id }
}