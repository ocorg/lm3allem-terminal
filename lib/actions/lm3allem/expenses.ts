"use server"

import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { requireAdmin } from "@/lib/auth/guard"
import { logActivity } from "@/lib/activity/logger"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { actorLabel } from "@/lib/utils/actor"
import { calendarDate, endOfDay, startOfDay } from "@/lib/utils/time"
import { id, moneyPositive, parseInput, asId } from "@/lib/validation"
import { parseAmount } from "@/lib/utils/money"

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
  await requireAdmin()

  const where: Record<string, unknown> = {}
  if (filters.portal) where.portal = filters.portal
  if (filters.categoryId) where.categoryId = filters.categoryId
  if (filters.from || filters.to) {
    const date: Record<string, Date> = {}
    if (filters.from) date.gte = startOfDay(filters.from)
    if (filters.to) date.lte = endOfDay(filters.to)
    where.date = date
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      category: { select: { label_fr: true, label_ar: true } },
      recordedBy: { select: { name: true, role: true } },
    },
    take: 2000,
  })

  return expenses.map((e) => ({
    id: e.id,
    portal: e.portal,
    categoryId: e.categoryId,
    categoryLabel_fr: e.category.label_fr,
    categoryLabel_ar: e.category.label_ar,
    amount: e.amount.toString(),
    description: e.description,
    date: e.date.toISOString(),
    receiptUrl: e.receiptUrl ?? null,
    recordedByName: actorLabel(e.recordedBy),
    createdAt: e.createdAt.toISOString(),
  }))
}

export interface CreateExpenseInput {
  portal: "magazin" | "costumes" | "lm3allem"
  categoryId: string
  /** typed amount (Arabic or Western digits accepted) */
  amount: string
  description: string
  date: string
  receiptUrl?: string
}

const receipt = z.string().trim().max(600).refine(
  (u) => u === "" || /^https?:\/\//.test(u) || u.startsWith("/api/files/"),
  { message: "invalid receipt link" }
)

const expenseSchema = z.object({
  portal:      z.enum(["magazin", "costumes", "lm3allem"]),
  categoryId:  id,
  amount:      moneyPositive,
  description: z.string().trim().min(1).max(500),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  receiptUrl:  receipt.optional(),
})

async function assertExpenseCategory(categoryId: string) {
  const ok = await prisma.lookupValue.findFirst({
    where:  { id: categoryId, category: { slug: "expense_categories" } },
    select: { id: true },
  })
  if (!ok) throw new ActionError("validation", "فئة المصروف غير صالحة")
}

export async function createExpense(
  input: CreateExpenseInput
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const actor = await requireAdmin()
    const data  = parseInput(expenseSchema, { ...input, amount: parseAmount(input.amount) })
    await assertExpenseCategory(data.categoryId)

    const expense = await prisma.expense.create({
      data: {
        portal:       data.portal,
        categoryId:   data.categoryId,
        amount:       data.amount,
        description:  data.description,
        date:         calendarDate(data.date),
        receiptUrl:   data.receiptUrl || null,
        recordedById: actor.id,
      },
    })

    await logActivity({
      portal: data.portal, entityType: "expense", entityId: expense.id, actor,
      action: "expense.created", diff: { amount: data.amount, portal: data.portal },
    })

    return { id: expense.id }
  })
}

export interface UpdateExpenseInput {
  id: string
  categoryId?: string
  amount?: string
  description?: string
  date?: string
  receiptUrl?: string | null
}

export async function updateExpense(input: UpdateExpenseInput): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireAdmin()

    const existing = await prisma.expense.findUnique({ where: { id: input.id } })
    if (!existing) throw new ActionError("not_found")

    const data = parseInput(
      expenseSchema.partial().omit({ portal: true }),
      {
        categoryId:  input.categoryId,
        amount:      input.amount !== undefined ? parseAmount(input.amount) : undefined,
        description: input.description,
        date:        input.date,
        receiptUrl:  input.receiptUrl ?? undefined,
      }
    )
    if (data.categoryId) await assertExpenseCategory(data.categoryId)

    await prisma.expense.update({
      where: { id: input.id },
      data: {
        ...(data.categoryId  !== undefined && { categoryId: data.categoryId }),
        ...(data.amount      !== undefined && { amount: data.amount }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.date        !== undefined && { date: calendarDate(data.date) }),
        ...(input.receiptUrl !== undefined && { receiptUrl: data.receiptUrl || null }),
      },
    })

    await logActivity({
      portal: existing.portal, entityType: "expense", entityId: input.id, actor, action: "expense.updated",
    })
  })
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  expenseId = asId(expenseId)
  return run(async () => {
    const actor = await requireAdmin()

    const expense = await prisma.expense.findUnique({ where: { id: expenseId } })
    if (!expense) throw new ActionError("not_found")

    await prisma.expense.delete({ where: { id: expenseId } })

    await logActivity({
      portal: expense.portal, entityType: "expense", entityId: expenseId, actor,
      action: "expense.deleted", diff: { amount: expense.amount.toString(), description: expense.description },
    })
  })
}
