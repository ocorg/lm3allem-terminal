"use server"

import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { getActiveLookups } from "@/lib/queries/lookups"
import { requireAdmin, requireModule } from "@/lib/auth/guard"
import { logActivity } from "@/lib/activity/logger"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { nextItemSku } from "@/lib/utils/counter"
import { id, money, parseInput, asId } from "@/lib/validation"
import type { LookupItem, LookupById } from "./pos"

// ── Shapes ─────────────────────────────────────────────────────

export type CostumeSegment = "rental" | "sale"

/**
 * Field meaning for RENTAL items (legacy column names, see schema):
 *   sizeId = suit size · colorId = PANTS size · shirtSizeId = shirt size · shoeSizeId = shoe size
 */
export interface CostumeItemForInventory {
  id:              string
  sku:             string | null
  segment:         CostumeSegment
  name_ar:         string
  typeId:          string
  typeLabelAr:     string
  sizeId:          string | null  // مقاس البدلة
  colorId:         string | null  // مقاس السروال
  shirtSizeId:     string | null  // مقاس القميص
  shoeSizeId:      string | null  // مقاس الحذاء
  stock:           number
  images:          string[]
  isActive:        boolean
  buyingPrice:     string
  sellingPrice:    string
  minSellingPrice: string
  refGuidePrice:   string | null
  createdAt:       string
}

export interface CostumeItemInput {
  segment:          CostumeSegment
  typeId:           string
  /** required for sale items; rental items are named after their type */
  name_ar?:         string
  sizeId:           string | null
  colorId:          string | null
  shirtSizeId:      string | null
  shoeSizeId:       string | null
  stock:            number
  /** stock the form was loaded with: the save applies the DIFFERENCE (edit only) */
  originalStock?:   number
  images:           string[]
  /** sale items */
  buyingPrice?:     number
  sellingPrice?:    number
  minSellingPrice?: number
  /** rental items: reference rental price (suggested total in the wizard) */
  refGuidePrice?:   number | null
}

const imageUrl = z.string().max(600).refine(
  (u) => /^https:\/\//.test(u) || u.startsWith("/api/files/"),
  { message: "invalid image" }
)

const itemSchema = z.object({
  segment:         z.enum(["rental", "sale"]),
  typeId:          id,
  name_ar:         z.string().trim().max(200).optional(),
  sizeId:          id.nullable(),
  colorId:         id.nullable(),
  shirtSizeId:     id.nullable(),
  shoeSizeId:      id.nullable(),
  stock:           z.number().int().min(0).max(1_000_000),
  originalStock:   z.number().int().min(0).max(1_000_000).optional(),
  images:          z.array(imageUrl).max(12),
  buyingPrice:     money.optional(),
  sellingPrice:    money.optional(),
  minSellingPrice: money.optional(),
  refGuidePrice:   money.nullable().optional(),
})

// ── getCostumeItems ────────────────────────────────────────────

export async function getCostumeItems(): Promise<CostumeItemForInventory[]> {
  await requireModule("costumes", "rental_inventory")

  const items = await prisma.costumeItem.findMany({
    include: { costumeType: true },
    orderBy: { createdAt: "desc" },
    take:    5000,
  })
  return items.map((i) => ({
    id:              i.id,
    sku:             i.sku,
    segment:         i.segment,
    name_ar:         i.name_ar,
    typeId:          i.typeId,
    typeLabelAr:     i.costumeType.label_ar,
    sizeId:          i.sizeId,
    colorId:         i.colorId,
    shirtSizeId:     i.shirtSizeId,
    shoeSizeId:      i.shoeSizeId,
    stock:           i.stock,
    images:          i.images,
    isActive:        i.isActive,
    buyingPrice:     i.buyingPrice.toString(),
    sellingPrice:    i.sellingPrice.toString(),
    minSellingPrice: i.minSellingPrice.toString(),
    refGuidePrice:   i.refGuidePrice?.toString() ?? null,
    createdAt:       i.createdAt.toISOString(),
  }))
}

// ── getInventoryLookups ────────────────────────────────────────

export async function getInventoryLookups(): Promise<{
  suitSizes:    LookupItem[]
  pantsSizes:   LookupItem[]
  shirtSizes:   LookupItem[]
  shoeSizes:    LookupItem[]
  costumeTypes: LookupItem[]
  lookupById:   LookupById
}> {
  await requireModule("costumes", "rental_inventory")

  const rawLookup = await getActiveLookups()

  const bySlug = (slug: string): LookupItem[] =>
    rawLookup
      .filter((lv) => lv.category.slug === slug)
      .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  const lookupById: LookupById = {}
  for (const lv of rawLookup) {
    lookupById[lv.id] = { label_fr: lv.label_fr, label_ar: lv.label_ar }
  }

  return {
    suitSizes:    bySlug("suit_sizes"),
    pantsSizes:   bySlug("pants_sizes"),
    shirtSizes:   bySlug("shirt_sizes"),
    shoeSizes:    bySlug("shoe_sizes"),
    costumeTypes: bySlug("costume_item_types"),
    lookupById,
  }
}

function validateItem(raw: unknown) {
  const input = parseInput(itemSchema, raw)

  if (input.segment === "sale") {
    if (!input.name_ar?.trim()) throw new ActionError("validation", "اسم القطعة مطلوب")
    if (input.sellingPrice === undefined || input.minSellingPrice === undefined) {
      throw new ActionError("validation", "سعر البيع والحد الأدنى مطلوبان")
    }
    if (input.minSellingPrice > input.sellingPrice) {
      throw new ActionError("validation", "الحد الأدنى يجب ألا يتجاوز سعر البيع")
    }
  }
  return input
}

// ── createCostumeItem ──────────────────────────────────────────

export async function createCostumeItem(rawInput: CostumeItemInput): Promise<ActionResult<{ id: string; sku: string }>> {
  return run(async () => {
    const user  = await requireAdmin()
    const input = validateItem(rawInput)

    const type = await prisma.lookupValue.findFirst({
      where:  { id: input.typeId, category: { slug: "costume_item_types" } },
      select: { label_ar: true, label_fr: true },
    })
    if (!type) throw new ActionError("validation", "نوع القطعة غير صالح")

    const isSale = input.segment === "sale"
    const name   = isSale ? input.name_ar!.trim() : type.label_ar

    const item = await prisma.$transaction(async (tx) => {
      const sku = await nextItemSku(tx)
      return tx.costumeItem.create({
        data: {
          sku,
          name_fr:         isSale ? name : type.label_fr,
          name_ar:         name,
          typeId:          input.typeId,
          segment:         input.segment,
          sizeId:          input.sizeId,
          colorId:         input.colorId,
          shirtSizeId:     input.shirtSizeId,
          shoeSizeId:      input.shoeSizeId,
          stock:           input.stock,
          buyingPrice:     isSale ? (input.buyingPrice ?? 0) : 0,
          sellingPrice:    isSale ? input.sellingPrice! : 0,
          minSellingPrice: isSale ? input.minSellingPrice! : 0,
          refGuidePrice:   isSale ? null : (input.refGuidePrice ?? null),
          images:          input.images,
        },
      })
    })

    await logActivity({
      portal: "costumes", entityType: "costume_item", entityId: item.id, actor: user,
      action: "costume_item.created", diff: { sku: item.sku, segment: input.segment, typeId: input.typeId, stock: input.stock },
    })

    return { id: item.id, sku: item.sku! }
  })
}

// ── updateCostumeItem ──────────────────────────────────────────

export async function updateCostumeItem(itemId: string, rawInput: CostumeItemInput): Promise<ActionResult> {
  itemId = asId(itemId)
  return run(async () => {
    const user  = await requireAdmin()
    const input = validateItem(rawInput)

    const existing = await prisma.costumeItem.findUnique({
      where:  { id: itemId },
      select: { stock: true, segment: true },
    })
    if (!existing) throw new ActionError("not_found")
    if (existing.segment !== input.segment) throw new ActionError("validation", "لا يمكن تغيير نوع القطعة (إيجار/بيع)")

    const type = await prisma.lookupValue.findFirst({
      where:  { id: input.typeId, category: { slug: "costume_item_types" } },
      select: { label_ar: true, label_fr: true },
    })
    if (!type) throw new ActionError("validation", "نوع القطعة غير صالح")

    const isSale = input.segment === "sale"
    const name   = isSale ? input.name_ar!.trim() : type.label_ar

    await prisma.$transaction(async (tx) => {
      // Stock: apply the DIFFERENCE against the loaded value so concurrent rentals/sales are kept.
      const delta = input.stock - (input.originalStock ?? existing.stock)
      if (delta < 0) {
        const res = await tx.costumeItem.updateMany({
          where: { id: itemId, stock: { gte: -delta } },
          data:  { stock: { decrement: -delta } },
        })
        if (res.count !== 1) throw new ActionError("insufficient_stock")
      } else if (delta > 0) {
        await tx.costumeItem.update({ where: { id: itemId }, data: { stock: { increment: delta } } })
      }

      await tx.costumeItem.update({
        where: { id: itemId },
        data: {
          name_fr:         isSale ? name : type.label_fr,
          name_ar:         name,
          typeId:          input.typeId,
          sizeId:          input.sizeId,
          colorId:         input.colorId,
          shirtSizeId:     input.shirtSizeId,
          shoeSizeId:      input.shoeSizeId,
          images:          input.images,
          ...(isSale
            ? {
                buyingPrice:     input.buyingPrice ?? 0,
                sellingPrice:    input.sellingPrice!,
                minSellingPrice: input.minSellingPrice!,
              }
            : { refGuidePrice: input.refGuidePrice ?? null }),
        },
      })
    })

    await logActivity({
      portal: "costumes", entityType: "costume_item", entityId: itemId, actor: user,
      action: "costume_item.updated", diff: { typeId: input.typeId, stock: input.stock },
    })
  })
}

// ── toggleCostumeItemActive ────────────────────────────────────

export async function toggleCostumeItemActive(itemId: string): Promise<ActionResult> {
  itemId = asId(itemId)
  return run(async () => {
    const user = await requireAdmin()
    const item = await prisma.costumeItem.findUnique({ where: { id: itemId }, select: { isActive: true } })
    if (!item) throw new ActionError("not_found")

    await prisma.costumeItem.update({ where: { id: itemId }, data: { isActive: !item.isActive } })

    await logActivity({
      portal: "costumes", entityType: "costume_item", entityId: itemId, actor: user,
      action: item.isActive ? "costume_item.deactivated" : "costume_item.activated",
    })
  })
}
