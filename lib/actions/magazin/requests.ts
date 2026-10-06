"use server"

import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { requireAdmin, requireModule } from "@/lib/auth/guard"
import { logActivity } from "@/lib/activity/logger"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { actorLabel } from "@/lib/utils/actor"
import { id, optionalText, parseInput, asId } from "@/lib/validation"
import type { LookupItem } from "./pos"

// ── Shapes ─────────────────────────────────────────
export interface RequestForList {
  id:               string
  productName:      string
  categoryId:       string | null
  requestCount:     number
  notes:            string | null
  status:           string
  createdAt:        string
  requestedByName:  string
}

export interface LookupEntry {
  id:       string
  label_fr: string
  label_ar: string
  slug:     string
}

export type ProductRequestForList = RequestForList

// ── getRequests ────────────────────────────────────
export async function getRequests(): Promise<RequestForList[]> {
  await requireModule("magazin", "requests")

  const requests = await prisma.productRequest.findMany({
    include: { requestedBy: { select: { name: true, role: true } } },
    orderBy: [{ requestCount: "desc" }, { updatedAt: "desc" }],
    take:    1000,
  })

  return requests.map((r) => ({
    id:              r.id,
    productName:     r.productName,
    categoryId:      r.categoryId,
    requestCount:    r.requestCount,
    notes:           r.notes,
    status:          r.status,
    createdAt:       r.createdAt.toISOString(),
    requestedByName: actorLabel(r.requestedBy),
  }))
}

// ── getRequestCategories ───────────────────────────
export async function getRequestCategories(): Promise<LookupItem[]> {
  await requireModule("magazin", "requests")

  return prisma.lookupValue.findMany({
    where:   { isActive: true, category: { slug: "product_categories" } },
    orderBy: { order: "asc" },
    select:  { id: true, label_fr: true, label_ar: true },
  })
}

const requestSchema = z.object({
  productName: z.string().trim().min(1).max(200),
  categoryId:  id.nullable(),
  notes:       optionalText(500),
})

// ── createRequest ──────────────────────────────────
export async function createRequest(
  productName: string,
  categoryId:  string | null,
  notes?:      string
): Promise<ActionResult<{ incremented: boolean }>> {
  return run(async () => {
    const user  = await requireModule("magazin", "requests")
    const input = parseInput(requestSchema, { productName, categoryId, notes })

    const existing = await prisma.productRequest.findFirst({
      where: { productName: { equals: input.productName, mode: "insensitive" } },
    })

    if (existing) {
      await prisma.productRequest.update({
        where: { id: existing.id },
        data:  { requestCount: { increment: 1 } },
      })
      return { incremented: true }
    }

    await prisma.productRequest.create({
      data: {
        productName:   input.productName,
        categoryId:    input.categoryId,
        notes:         input.notes ?? null,
        requestedById: user.id,
      },
    })

    return { incremented: false }
  })
}

// ── updateRequestStatus ────────────────────────────
export async function updateRequestStatus(
  requestId: string,
  status:    "pending" | "reviewed" | "ordered"
): Promise<ActionResult> {
  requestId = asId(requestId)
  return run(async () => {
    const user = await requireAdmin()
    if (!["pending", "reviewed", "ordered"].includes(status)) throw new ActionError("validation")

    const res = await prisma.productRequest.updateMany({ where: { id: requestId }, data: { status } })
    if (res.count === 0) throw new ActionError("not_found")

    await logActivity({
      portal: "magazin", entityType: "productRequest", entityId: requestId, actor: user,
      action: `request.${status}`,
    })
  })
}
