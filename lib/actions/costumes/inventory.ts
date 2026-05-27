"use server"

import { prisma }      from "@/lib/db/prisma"
import { auth }        from "@/lib/auth/auth"
import { logActivity } from "@/lib/activity/logger"
import type { CostumeItemType } from "@prisma/client"
import type { LookupItem, LookupById } from "./pos"

// ── Shapes ─────────────────────────────────────────────────────
export interface CostumeItemForInventory {
  id:              string
  name_fr:         string
  name_ar:         string
  type:            CostumeItemType
  sizeId:          string | null
  colorId:         string | null
  stock:           number
  buyingPrice:     string
  sellingPrice:    string
  minSellingPrice: string
  images:          string[]
  isActive:        boolean
  createdAt:       string
}

export interface CostumeItemInput {
  name_fr:         string
  name_ar:         string
  type:            CostumeItemType
  sizeId:          string | null
  colorId:         string | null
  stock:           number
  buyingPrice:     number
  sellingPrice:    number
  minSellingPrice: number
  images:          string[]
}

// ── getCostumeItems ────────────────────────────────────────────
export async function getCostumeItems(): Promise<CostumeItemForInventory[]> {
  const items = await prisma.costumeItem.findMany({
    orderBy: { createdAt: "desc" },
  })
  return items.map((i) => ({
    id:              i.id,
    name_fr:         i.name_fr,
    name_ar:         i.name_ar,
    type:            i.type,
    sizeId:          i.sizeId,
    colorId:         i.colorId,
    stock:           i.stock,
    buyingPrice:     i.buyingPrice.toString(),
    sellingPrice:    i.sellingPrice.toString(),
    minSellingPrice: i.minSellingPrice.toString(),
    images:          i.images,
    isActive:        i.isActive,
    createdAt:       i.createdAt.toISOString(),
  }))
}

// ── getInventoryLookups ────────────────────────────────────────
export async function getInventoryLookups(): Promise<{
  sizes:      LookupItem[]
  colors:     LookupItem[]
  lookupById: LookupById
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
    .filter((lv) => lv.category.slug.endsWith("_colors"))
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  const lookupById: LookupById = {}
  for (const lv of rawLookup) {
    lookupById[lv.id] = { label_fr: lv.label_fr, label_ar: lv.label_ar }
  }

  return { sizes, colors, lookupById }
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
      type:            input.type,
      sizeId:          input.sizeId,
      colorId:         input.colorId,
      stock:           input.stock,
      buyingPrice:     input.buyingPrice,
      sellingPrice:    input.sellingPrice,
      minSellingPrice: input.minSellingPrice,
      images:          input.images,
    },
  })

  await logActivity({
    portal:     "costumes",
    entityType: "costume_item",
    entityId:   item.id,
    actorId:    authSession.user.id,
    action:     "costume_item.created",
    diff:       { name_fr: input.name_fr, type: input.type, stock: input.stock },
  })

  return { id: item.id }
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
      type:            input.type,
      sizeId:          input.sizeId,
      colorId:         input.colorId,
      stock:           input.stock,
      buyingPrice:     input.buyingPrice,
      sellingPrice:    input.sellingPrice,
      minSellingPrice: input.minSellingPrice,
      images:          input.images,
    },
  })

  await logActivity({
    portal:     "costumes",
    entityType: "costume_item",
    entityId:   id,
    actorId:    authSession.user.id,
    action:     "costume_item.updated",
    diff:       { name_fr: input.name_fr, type: input.type, stock: input.stock },
  })
}