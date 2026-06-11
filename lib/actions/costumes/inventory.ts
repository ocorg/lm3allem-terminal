"use server"

import { prisma }      from "@/lib/db/prisma"
import { auth }        from "@/lib/auth/auth"
import { logActivity } from "@/lib/activity/logger"
import type { ItemSegment } from "@prisma/client"
import type { LookupItem, LookupById } from "./pos"

// ── Shapes ─────────────────────────────────────────────────────
export interface CostumeItemForInventory {
  id:              string
  name_fr:         string
  name_ar:         string
  typeId:          string
  typeLabelFr:     string
  segment:         ItemSegment
  sizeId:          string | null
  colorId:         string | null
  stock:           number
  buyingPrice:     string
  sellingPrice:    string
  minSellingPrice: string
  refGuidePrice:   string | null
  images:          string[]
  isActive:        boolean
  createdAt:       string
}

export interface CostumeItemInput {
  name_fr:         string
  name_ar:         string
  typeId:          string
  segment:         ItemSegment
  sizeId:          string | null
  colorId:         string | null
  stock:           number
  buyingPrice:     number
  sellingPrice:    number
  minSellingPrice: number
  refGuidePrice:   number | null
  images:          string[]
}

// ── getCostumeItems ────────────────────────────────────────────
export async function getCostumeItems(segment?: ItemSegment): Promise<CostumeItemForInventory[]> {
  const items = await prisma.costumeItem.findMany({
    where:   segment ? { segment } : undefined,
    include: { costumeType: true },
    orderBy: { createdAt: "desc" },
  })
  return items.map((i) => ({
    id:              i.id,
    name_fr:         i.name_fr,
    name_ar:         i.name_ar,
    typeId:          i.typeId,
    typeLabelFr:     i.costumeType.label_fr,
    segment:         i.segment,
    sizeId:          i.sizeId,
    colorId:         i.colorId,
    stock:           i.stock,
    buyingPrice:     i.buyingPrice.toString(),
    sellingPrice:    i.sellingPrice.toString(),
    minSellingPrice: i.minSellingPrice.toString(),
    refGuidePrice:   i.refGuidePrice?.toString() ?? null,
    images:          i.images,
    isActive:        i.isActive,
    createdAt:       i.createdAt.toISOString(),
  }))
}

// ── getInventoryLookups ────────────────────────────────────────
export async function getInventoryLookups(): Promise<{
  sizes:        LookupItem[]
  colors:       LookupItem[]
  costumeTypes: LookupItem[]
  lookupById:   LookupById
}> {
  const rawLookup = await prisma.lookupValue.findMany({
    where:   { isActive: true },
    include: { category: { select: { slug: true } } },
    orderBy: { order: "asc" },
  })

  const sizes = rawLookup
    .filter((lv) => lv.category.slug.endsWith("_sizes"))
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  const colors = rawLookup
    .filter((lv) => lv.category.slug === "suit_colors")
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  const lookupById: LookupById = {}
  for (const lv of rawLookup) {
    lookupById[lv.id] = { label_fr: lv.label_fr, label_ar: lv.label_ar }
  }

  const costumeTypes = rawLookup
    .filter((lv) => lv.category.slug === "costume_item_types")
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  return { sizes, colors, costumeTypes, lookupById }
}

// ── createCostumeItem ──────────────────────────────────────────
export async function createCostumeItem(
  input: CostumeItemInput
): Promise<{ id: string }> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")

  const item = await prisma.costumeItem.create({
    data: {
      name_fr:         input.name_fr,
      name_ar:         input.name_ar,
      typeId:          input.typeId,
      segment:         input.segment,
      sizeId:          input.sizeId,
      colorId:         input.colorId,
      stock:           input.stock,
      buyingPrice:     input.buyingPrice,
      sellingPrice:    input.segment === "sale" ? input.sellingPrice    : 0,
      minSellingPrice: input.segment === "sale" ? input.minSellingPrice : 0,
      refGuidePrice:   input.segment === "rental" ? input.refGuidePrice : null,
      images:          input.images,
    },
  })

  await logActivity({
    portal:     "costumes",
    entityType: "costume_item",
    entityId:   item.id,
    actorId:    authSession.user.id,
    action:     "costume_item.created",
    diff:       { name_fr: input.name_fr, typeId: input.typeId, stock: input.stock },
  })

  return { id: item.id }
}

// ── addCostumeType ─────────────────────────────────────────────
export async function addCostumeType(
  labelFr: string,
  labelAr: string
): Promise<LookupItem> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")
  if (authSession.user.role !== "admin" && authSession.user.role !== "superadmin")
    throw new Error("Forbidden")

  const category = await prisma.lookupCategory.findUniqueOrThrow({
    where: { slug: "costume_item_types" },
  })

  const maxResult = await prisma.lookupValue.aggregate({
    where: { categoryId: category.id },
    _max:  { order: true },
  })

  const value = await prisma.lookupValue.create({
    data: {
      categoryId: category.id,
      label_fr:   labelFr,
      label_ar:   labelAr,
      order:      (maxResult._max.order ?? 0) + 1,
      isActive:   true,
    },
  })

  await logActivity({
    portal:     "costumes",
    entityType: "lookup_value",
    entityId:   value.id,
    actorId:    authSession.user.id,
    action:     "lookup_value.created",
    diff:       { label_fr: labelFr, categoryId: category.id },
  })

  return { id: value.id, label_fr: value.label_fr, label_ar: value.label_ar }
}

// ── updateCostumeItem ──────────────────────────────────────────
export async function updateCostumeItem(
  id: string,
  input: CostumeItemInput
): Promise<void> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")

  await prisma.costumeItem.update({
    where: { id },
    data: {
      name_fr:         input.name_fr,
      name_ar:         input.name_ar,
      typeId:          input.typeId,
      segment:         input.segment,
      sizeId:          input.sizeId,
      colorId:         input.colorId,
      stock:           input.stock,
      buyingPrice:     input.buyingPrice,
      sellingPrice:    input.segment === "sale" ? input.sellingPrice    : 0,
      minSellingPrice: input.segment === "sale" ? input.minSellingPrice : 0,
      refGuidePrice:   input.segment === "rental" ? input.refGuidePrice : null,
      images:          input.images,
    },
  })

  await logActivity({
    portal:     "costumes",
    entityType: "costume_item",
    entityId:   id,
    actorId:    authSession.user.id,
    action:     "costume_item.updated",
    diff:       { name_fr: input.name_fr, typeId: input.typeId, stock: input.stock },
  })
}