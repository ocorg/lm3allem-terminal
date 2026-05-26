"use server"

import { prisma }   from "@/lib/db/prisma"
import type { LookupItem, LookupById, ProductForPOS as ProductForCatalogue } from "./pos"

export async function getCatalogueProducts(): Promise<{
  products:   ProductForCatalogue[]
  categories: LookupItem[]
  sizes:      LookupItem[]
  colors:     LookupItem[]
  lookupById: LookupById
}> {
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
        variants: {
          select: { id: true, sizeId: true, colorId: true, stock: true },
        },
      },
      orderBy: { name_fr: "asc" },
    }),
    prisma.lookupValue.findMany({
      where:   { isActive: true },
      include: { category: { select: { slug: true } } },
      orderBy: { order: "asc" },
    }),
  ])

  const categories = rawLookup
    .filter((lv) => lv.category.slug === "product_categories")
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  const lookupById: LookupById = {}
  for (const lv of rawLookup) {
    lookupById[lv.id] = { label_fr: lv.label_fr, label_ar: lv.label_ar }
  }

  const products = rawProducts.map((p) => ({
    ...p,
    sellingPrice:    p.sellingPrice.toString(),
    minSellingPrice: p.minSellingPrice.toString(),
  }))

  const sizes = rawLookup
    .filter((lv) => lv.category.slug.endsWith("_sizes"))
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  const colors = rawLookup
    .filter((lv) => lv.category.slug.endsWith("_colors"))
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  return { products, categories, sizes, colors, lookupById }
}