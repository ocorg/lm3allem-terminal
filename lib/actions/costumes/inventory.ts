"use server"

import { prisma }      from "@/lib/db/prisma"
import { auth }        from "@/lib/auth/auth"
import { logActivity } from "@/lib/activity/logger"
import type { LookupItem, LookupById } from "./pos"

// ── Shapes ─────────────────────────────────────────────────────

export interface CostumeItemForInventory {
  id:          string
  typeId:      string
  typeLabelAr: string
  sizeId:      string | null  // مقاس البدلة
  colorId:     string | null  // مقاس السروال
  shirtSizeId: string | null  // مقاس القميجة
  shoeSizeId:  string | null  // مقاس الصباط
  stock:       number
  images:      string[]
  isActive:    boolean
  createdAt:   string
}

export interface CostumeItemInput {
  typeId:      string
  sizeId:      string | null
  colorId:     string | null
  shirtSizeId: string | null
  shoeSizeId:  string | null
  stock:       number
  images:      string[]
}

// ── getCostumeItems ────────────────────────────────────────────

export async function getCostumeItems(): Promise<CostumeItemForInventory[]> {
  const items = await prisma.costumeItem.findMany({
    where:   { segment: "rental" },
    include: { costumeType: true },
    orderBy: { createdAt: "desc" },
  })
  return items.map((i) => ({
    id:          i.id,
    typeId:      i.typeId,
    typeLabelAr: i.costumeType.label_ar,
    sizeId:      i.sizeId,
    colorId:     i.colorId,
    shirtSizeId: i.shirtSizeId ?? null,
    shoeSizeId:  i.shoeSizeId  ?? null,
    stock:       i.stock,
    images:      i.images,
    isActive:    i.isActive,
    createdAt:   i.createdAt.toISOString(),
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
  const rawLookup = await prisma.lookupValue.findMany({
    where:   { isActive: true },
    include: { category: { select: { slug: true } } },
    orderBy: { order: "asc" },
  })

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

// ── createCostumeItem ──────────────────────────────────────────

export async function createCostumeItem(input: CostumeItemInput): Promise<{ id: string }> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")

  const typeLabel = await prisma.lookupValue.findUnique({
    where:  { id: input.typeId },
    select: { label_ar: true },
  })
  const autoName = typeLabel?.label_ar ?? "قطعة"

  const item = await prisma.costumeItem.create({
    data: {
      name_fr:         autoName,
      name_ar:         autoName,
      typeId:          input.typeId,
      segment:         "rental",
      sizeId:          input.sizeId,
      colorId:         input.colorId,
      shirtSizeId:     input.shirtSizeId,
      shoeSizeId:  input.shoeSizeId,
      stock:           input.stock,
      buyingPrice:     0,
      sellingPrice:    0,
      minSellingPrice: 0,
      refGuidePrice:   null,
      images:          input.images,
    },
  })

  await logActivity({
    portal:     "costumes",
    entityType: "costume_item",
    entityId:   item.id,
    actorId:    authSession.user.id,
    action:     "costume_item.created",
    diff:       { typeId: input.typeId, stock: input.stock },
  })

  return { id: item.id }
}

// ── updateCostumeItem ──────────────────────────────────────────

export async function updateCostumeItem(id: string, input: CostumeItemInput): Promise<void> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")

  const typeLabel = await prisma.lookupValue.findUnique({
    where:  { id: input.typeId },
    select: { label_ar: true },
  })
  const autoName = typeLabel?.label_ar ?? "قطعة"

  await prisma.costumeItem.update({
    where: { id },
    data: {
      name_fr:     autoName,
      name_ar:     autoName,
      typeId:      input.typeId,
      sizeId:      input.sizeId,
      colorId:     input.colorId,
      shirtSizeId: input.shirtSizeId,
      shoeSizeId:  input.shoeSizeId,
      stock:       input.stock,
      images:      input.images,
    },
  })

  await logActivity({
    portal:     "costumes",
    entityType: "costume_item",
    entityId:   id,
    actorId:    authSession.user.id,
    action:     "costume_item.updated",
    diff:       { typeId: input.typeId, stock: input.stock },
  })
}