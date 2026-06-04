"use server"

import { prisma }   from "@/lib/db/prisma"
import type { CostumeItemType } from "@prisma/client"
import type { LookupItem, LookupById } from "./pos"

// ── Shape ──────────────────────────────────────────────────────
export interface CostumeItemForCatalogue {
  id:           string
  name_fr:      string
  name_ar:      string
  type:         CostumeItemType
  sizeId:       string | null
  colorId:      string | null
  stock:        number
  sellingPrice: string
  images:       string[]
}

// ── getCostumeCatalogue ────────────────────────────────────────
export async function getCostumeCatalogue(): Promise<{
  items:     CostumeItemForCatalogue[]
  sizes:     LookupItem[]
  colors:    LookupItem[]
  lookupById: LookupById
}> {
  const [rawItems, rawLookup] = await Promise.all([
    prisma.costumeItem.findMany({
      where:   { isActive: true, segment: "sale" },
      orderBy: { name_fr: "asc" },
    }),
    prisma.lookupValue.findMany({
      where:   { isActive: true },
      include: { category: { select: { slug: true } } },
      orderBy: { order: "asc" },
    }),
  ])

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

  return {
    items: rawItems.map((i) => ({
      id:           i.id,
      name_fr:      i.name_fr,
      name_ar:      i.name_ar,
      type:         i.type,
      sizeId:       i.sizeId,
      colorId:      i.colorId,
      stock:        i.stock,
      sellingPrice: i.sellingPrice.toString(),
      images:       i.images,
    })),
    sizes,
    colors,
    lookupById,
  }
}