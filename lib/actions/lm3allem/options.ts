"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/prisma"
import { logActivity } from "@/lib/activity/logger"

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
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

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
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

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

export interface CreateLookupValueInput {
  categoryId: string
  label_fr: string
  label_ar: string
}

export async function createLookupValue(
  input: CreateLookupValueInput
): Promise<SerializedLookupValue> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  // Compute next order OUTSIDE transaction (avoids lock during count)
  const maxResult = await prisma.lookupValue.aggregate({
    where: { categoryId: input.categoryId },
    _max: { order: true },
  })
  const nextOrder = (maxResult._max.order ?? 0) + 1

  const value = await prisma.lookupValue.create({
    data: {
      categoryId: input.categoryId,
      label_fr: input.label_fr,
      label_ar: input.label_ar,
      order: nextOrder,
      isActive: true,
    },
  })

  await logActivity({
    portal: "lm3allem",
    entityType: "lookup_value",
    entityId: value.id,
    actorId: session.user.id,
    action: "lookup_value.created",
    diff: { label_fr: input.label_fr, categoryId: input.categoryId },
  })

  return {
    id: value.id,
    categoryId: value.categoryId,
    label_fr: value.label_fr,
    label_ar: value.label_ar,
    order: value.order,
    isActive: value.isActive,
  }
}

export interface UpdateLookupValueInput {
  id: string
  label_fr?: string
  label_ar?: string
}

export async function updateLookupValue(
  input: UpdateLookupValueInput
): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  await prisma.lookupValue.update({
    where: { id: input.id },
    data: {
      ...(input.label_fr !== undefined && { label_fr: input.label_fr }),
      ...(input.label_ar !== undefined && { label_ar: input.label_ar }),
    },
  })

  await logActivity({
    portal: "lm3allem",
    entityType: "lookup_value",
    entityId: input.id,
    actorId: session.user.id,
    action: "lookup_value.updated",
  })
}

export async function toggleLookupValueActive(id: string): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const value = await prisma.lookupValue.findUniqueOrThrow({ where: { id } })

  await prisma.lookupValue.update({
    where: { id },
    data: { isActive: !value.isActive },
  })

  await logActivity({
    portal: "lm3allem",
    entityType: "lookup_value",
    entityId: id,
    actorId: session.user.id,
    action: value.isActive ? "lookup_value.deactivated" : "lookup_value.activated",
  })
}

export async function reorderLookupValues(orderedIds: string[]): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.lookupValue.update({
        where: { id },
        data: { order: index + 1 },
      })
    )
  )

  if (orderedIds.length > 0) {
    const first = await prisma.lookupValue.findUnique({
      where: { id: orderedIds[0] },
    })
    if (first) {
      await logActivity({
        portal: "lm3allem",
        entityType: "lookup_category",
        entityId: first.categoryId,
        actorId: session.user.id,
        action: "lookup_values.reordered",
      })
    }
  }
}