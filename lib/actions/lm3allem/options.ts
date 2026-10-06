"use server"

import { prisma } from "@/lib/db/prisma"
import { requireAdmin } from "@/lib/auth/guard"
import { asId } from "@/lib/validation"

export interface SerializedCategory {
  id: string
  slug: string
  name_fr: string
  name_ar: string
  valueCount: number
}

export interface SerializedLookupValue {
  id: string
  categoryId: string
  label_fr: string
  label_ar: string
  order: number
  isActive: boolean
}

export async function getLookupCategories(): Promise<SerializedCategory[]> {
  await requireAdmin()

  const categories = await prisma.lookupCategory.findMany({
    orderBy: { name_fr: "asc" },
    include: { _count: { select: { values: true } } },
  })

  return categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name_fr: c.name_fr,
    name_ar: c.name_ar,
    valueCount: c._count.values,
  }))
}

export async function getLookupValues(
  categoryId: string
): Promise<SerializedLookupValue[]> {
  categoryId = asId(categoryId)
  await requireAdmin()

  const values = await prisma.lookupValue.findMany({
    where: { categoryId },
    orderBy: { order: "asc" },
  })

  return values.map((v) => ({
    id: v.id,
    categoryId: v.categoryId,
    label_fr: v.label_fr,
    label_ar: v.label_ar,
    order: v.order,
    isActive: v.isActive,
  }))
}
