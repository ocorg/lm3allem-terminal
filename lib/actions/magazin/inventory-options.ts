"use server"

import { prisma }                    from "@/lib/db/prisma"
import { createLookupValue, toggleLookupValueActive } from "@/lib/actions/lm3allem/options"

export async function createLookupBySlug(slug: string, labelAr: string) {
  const cat = await prisma.lookupCategory.findFirst({ where: { slug } })
  if (!cat) throw new Error(`الفئة غير موجودة: ${slug}`)
  return createLookupValue({
    categoryId: cat.id,
    label_fr:   labelAr,
    label_ar:   labelAr,
  })
}

export async function removeLookupValue(id: string) {
  return toggleLookupValueActive(id)
}