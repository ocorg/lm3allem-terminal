"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/prisma"
import { logActivity } from "@/lib/activity/logger"

export interface SerializedExpense {
  id: string
  portal: string
  categoryId: string
  categoryLabel_fr: string
  categoryLabel_ar: string
  amount: string
  description: string
  date: string
  receiptUrl: string | null
  recordedByName: string
  createdAt: string
}

export interface ExpenseFilters {
  portal?: string
  categoryId?: string
  from?: string
  to?: string
}

export async function getExpenses(
  filters: ExpenseFilters = {}
): Promise<SerializedExpense[]> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const where: Record<string, unknown> = {}
  if (filters.portal) where.portal = filters.portal
  if (filters.categoryId) where.categoryId = filters.categoryId
  if (filters.from || filters.to) {
    const date: Record<string, Date> = {}
    if (filters.from) date.gte = new Date(filters.from)
    if (filters.to) date.lte = new Date(filters.to)
    where.date = date
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      category: { select: { label_fr: true, label_ar: true } },
      recordedBy: { select: { name: true } },
    },
  })

  return expenses.map((e) => ({
    id: e.id,
    portal: e.portal,
    categoryId: e.categoryId,
    categoryLabel_fr: (e.category as { label_fr: string; label_ar: string }).label_fr,
    categoryLabel_ar: (e.category as { label_fr: string; label_ar: string }).label_ar,
    amount: e.amount.toString(),
    description: e.description,
    date: e.date.toISOString(),
    receiptUrl: e.receiptUrl ?? null,
    recordedByName: e.recordedBy.name,
    createdAt: e.createdAt.toISOString(),
  }))
}

export interface CreateExpenseInput {
  portal: "magazin" | "costumes" | "lm3allem"
  categoryId: string
  amount: string
  description: string
  date: string
  receiptUrl?: string
}

export async function createExpense(
  input: CreateExpenseInput
): Promise<{ id: string }> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const expense = await prisma.expense.create({
    data: {
      portal: input.portal as any,
      categoryId: input.categoryId,
      amount: input.amount,
      description: input.description,
      date: new Date(input.date),
      receiptUrl: input.receiptUrl ?? null,
      recordedById: session.user.id,
    },
  })

  await logActivity({
    portal: input.portal,
    entityType: "expense",
    entityId: expense.id,
    actorId: session.user.id,
    action: "expense.created",
    diff: { amount: input.amount, portal: input.portal },
  })

  return { id: expense.id }
}

export interface UpdateExpenseInput {
  id: string
  categoryId?: string
  amount?: string
  description?: string
  date?: string
  receiptUrl?: string | null
}

export async function updateExpense(input: UpdateExpenseInput): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const existing = await prisma.expense.findUniqueOrThrow({ where: { id: input.id } })

  await prisma.expense.update({
    where: { id: input.id },
    data: {
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.date !== undefined && { date: new Date(input.date) }),
      ...(input.receiptUrl !== undefined && { receiptUrl: input.receiptUrl }),
    },
  })

  await logActivity({
    portal: existing.portal,
    entityType: "expense",
    entityId: input.id,
    actorId: session.user.id,
    action: "expense.updated",
  })
}

export async function deleteExpense(id: string): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const expense = await prisma.expense.findUniqueOrThrow({ where: { id } })

  await prisma.expense.delete({ where: { id } })

  await logActivity({
    portal: expense.portal,
    entityType: "expense",
    entityId: id,
    actorId: session.user.id,
    action: "expense.deleted",
  })
}