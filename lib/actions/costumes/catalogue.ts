"use server"

import { getActiveLookups } from "@/lib/queries/lookups"
import { prisma } from "@/lib/db/prisma"
import { requirePortal } from "@/lib/auth/guard"
import type { LookupItem, LookupById } from "./pos"

// ── Shape ──────────────────────────────────────────────────────
export interface CostumeItemForCatalogue {
  id:           string
  sku:          string | null
  name_fr:      string
  name_ar:      string
  typeId:       string
  typeLabelFr:  string
  typeLabelAr:  string
  sizeId:       string | null
  colorId:      string | null
  stock:        number
  sellingPrice: string
  images:       string[]
}

// ── getCostumeCatalogue ────────────────────────────────────────
// Open to every user who may enter the costumes portal. The minimum selling price is not sent.
export async function getCostumeCatalogue(): Promise<{
  items:        CostumeItemForCatalogue[]
  sizes:        LookupItem[]
  colors:       LookupItem[]
  costumeTypes: LookupItem[]
  lookupById:   LookupById
}> {
  await requirePortal("costumes")

  const [rawItems, rawLookup] = await Promise.all([
    prisma.costumeItem.findMany({
      where:   { isActive: true, segment: "sale" },
      include: { costumeType: true },
      orderBy: { name_fr: "asc" },
    }),
    getActiveLookups(),
  ])

  const lookupById: LookupById = {}
  for (const lv of rawLookup) {
    lookupById[lv.id] = { label_fr: lv.label_fr, label_ar: lv.label_ar }
  }

  // Filters only offer values that at least one item actually uses
  // (instead of every "*_sizes" / "*_colors" list mixed together).
  const usedSizes  = new Set(rawItems.map((i) => i.sizeId).filter((v): v is string => !!v))
  const usedColors = new Set(rawItems.map((i) => i.colorId).filter((v): v is string => !!v))
  const toItem = ({ id, label_fr, label_ar }: { id: string; label_fr: string; label_ar: string }) => ({ id, label_fr, label_ar })

  return {
    items: rawItems.map((i) => ({
      id:           i.id,
      sku:          i.sku,
      name_fr:      i.name_fr,
      name_ar:      i.name_ar,
      typeId:       i.typeId,
      typeLabelFr:  i.costumeType.label_fr,
      typeLabelAr:  i.costumeType.label_ar,
      sizeId:       i.sizeId,
      colorId:      i.colorId,
      stock:        i.stock,
      sellingPrice: i.sellingPrice.toString(),
      images:       i.images,
    })),
    sizes:  rawLookup.filter((lv) => usedSizes.has(lv.id)).map(toItem),
    colors: rawLookup.filter((lv) => usedColors.has(lv.id)).map(toItem),
    costumeTypes: rawLookup
      .filter((lv) => lv.category.slug === "costume_item_types")
      .map(toItem),
    lookupById,
  }
}
