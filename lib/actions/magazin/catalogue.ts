"use server"

import { getActiveLookups } from "@/lib/queries/lookups"
import { prisma } from "@/lib/db/prisma"
import { requirePortal } from "@/lib/auth/guard"
import type { LookupItem, LookupById, ProductForPOS as ProductForCatalogue } from "./pos"

/** The catalogue is open to every user who may enter the magazin portal. */
export async function getCatalogueProducts(): Promise<{
  products:   ProductForCatalogue[]
  categories: LookupItem[]
  sizes:      LookupItem[]
  colors:     LookupItem[]
  lookupById: LookupById
}> {
  await requirePortal("magazin")

  const [rawProducts, rawLookup] = await Promise.all([
    prisma.product.findMany({
      where:   { isActive: true },
      select: {
        id:              true,
        name_fr:         true,
        name_ar:         true,
        categoryId:      true,
        sellingPrice:    true,
        images:          true,
        variants: {
          select: { id: true, sizeId: true, colorId: true, stock: true },
        },
      },
      orderBy: { name_fr: "asc" },
    }),
    getActiveLookups(),
  ])

  const categories = rawLookup
    .filter((lv) => lv.category.slug === "product_categories")
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  const lookupById: LookupById = {}
  for (const lv of rawLookup) {
    lookupById[lv.id] = { label_fr: lv.label_fr, label_ar: lv.label_ar }
  }

  // The catalogue is read-only: the minimum selling price (a negotiation floor) is NOT sent to the browser.
  const products: ProductForCatalogue[] = rawProducts.map((p) => ({
    ...p,
    sellingPrice:    p.sellingPrice.toString(),
    minSellingPrice: p.sellingPrice.toString(),
  }))

  // Only offer filters that match at least one product variant
  const usedSizes  = new Set(rawProducts.flatMap((p) => p.variants.map((v) => v.sizeId)))
  const usedColors = new Set(rawProducts.flatMap((p) => p.variants.map((v) => v.colorId)))

  const sizes = rawLookup
    .filter((lv) => lv.category.slug === "product_sizes" && usedSizes.has(lv.id))
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  const colors = rawLookup
    .filter((lv) => lv.category.slug === "product_colors" && usedColors.has(lv.id))
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  return { products, categories, sizes, colors, lookupById }
}
