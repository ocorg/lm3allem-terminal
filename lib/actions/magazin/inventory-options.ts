"use server"

import { prisma }            from "@/lib/db/prisma"
import { createLookupValue } from "@/lib/actions/lm3allem/options"

export async function createLookupBySlug(
  slug: "product_categories" | "product_sizes" | "product_colors",
  labelAr: string,
  labelFr: string,
) {
  const cat = await prisma.lookupCategory.findFirst({ where: { slug } })
  if (!cat) throw new Error(`Lookup category not found: ${slug}`)
  return createLookupValue({
    categoryId: cat.id,
    label_fr:   labelFr || labelAr,
    label_ar:   labelAr,
  })
}