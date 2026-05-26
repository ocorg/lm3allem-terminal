"use server"

import { prisma }       from "@/lib/db/prisma"
import { auth }         from "@/lib/auth/auth"
import { logActivity }  from "@/lib/activity/logger"
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

// ── getRequests ────────────────────────────────────
export interface LookupEntry {
  id:       string
  label_fr: string
  label_ar: string
  slug:     string
}

export type ProductRequestForList = RequestForList

export async function getRequests(): Promise<RequestForList[]> {
  const requests = await prisma.productRequest.findMany({
    include: { requestedBy: { select: { name: true } } },
    orderBy: [{ requestCount: "desc" }, { updatedAt: "desc" }],
  })

  return requests.map((r) => ({
    id:              r.id,
    productName:     r.productName,
    categoryId:      r.categoryId,
    requestCount:    r.requestCount,
    notes:           r.notes,
    status:          r.status,
    createdAt:       r.createdAt.toISOString(),
    requestedByName: r.requestedBy.name,
  }))
}

// ── getRequestCategories ───────────────────────────
export async function getRequestCategories(): Promise<LookupItem[]> {
  const values = await prisma.lookupValue.findMany({
    where:   { isActive: true, category: { slug: "product_categories" } },
    orderBy: { order: "asc" },
    select:  { id: true, label_fr: true, label_ar: true },
  })
  return values
}

// ── createRequest ──────────────────────────────────
export async function createRequest(
  productName: string,
  categoryId:  string | null,
  notes?:      string
): Promise<{ incremented: boolean }> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")

  const existing = await prisma.productRequest.findFirst({
    where: { productName: { equals: productName, mode: "insensitive" } },
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
      productName,
      categoryId:      categoryId ?? null,
      notes:           notes ?? null,
      requestedById:   authSession.user.id,
    },
  })

  return { incremented: false }
}

// ── updateRequestStatus ────────────────────────────
export async function updateRequestStatus(
  id:     string,
  status: "pending" | "reviewed" | "ordered"
): Promise<void> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")
  if (!["admin", "superadmin"].includes(authSession.user.role)) {
    throw new Error("Forbidden")
  }

  await prisma.productRequest.update({ where: { id }, data: { status } })

  await logActivity({
    portal:     "magazin",
    entityType: "productRequest",
    entityId:   id,
    actorId:    authSession.user.id,
    action:     `request.${status}`,
  })
}