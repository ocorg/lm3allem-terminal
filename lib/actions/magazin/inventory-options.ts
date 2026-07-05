"use server"

import { prisma }                    from "@/lib/db/prisma"
import { createLookupValue, toggleLookupValueActive } from "@/lib/actions/lm3allem/options"

export async function createLookupBySlug(slug: string, labelAr: string) {
  const cat = await prisma.lookupCategory.findFirst({ where: { slug } })
  if (!cat) throw new Error(`الفئة غير موجودة: ${slug}`)

  const normalized = labelAr.trim().toLowerCase()
  if (!normalized) throw new Error("الاسم مطلوب")

  const existing = await prisma.lookupValue.findMany({ where: { categoryId: cat.id } })
  const match = existing.find(v =>
    v.label_ar.trim().toLowerCase() === normalized ||
    v.label_fr.trim().toLowerCase() === normalized
  )

  if (match) {
    if (match.isActive) {
      throw new Error("هذا الخيار موجود بالفعل")
    }
    // Was previously deleted — bring it back instead of creating a duplicate row
    return prisma.lookupValue.update({ where: { id: match.id }, data: { isActive: true } })
  }

  return createLookupValue({
    categoryId: cat.id,
    label_fr:   labelAr,
    label_ar:   labelAr,
  })
}

export async function removeLookupValue(id: string) {
  return toggleLookupValueActive(id)
}