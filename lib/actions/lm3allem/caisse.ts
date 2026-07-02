"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/prisma"

export interface SessionHistoryFilters {
  portal?: "magazin" | "costumes"
  status?: "open" | "closed"
  from?: string
  to?: string
  page?: number
}

export interface SerializedSessionHistory {
  id: string
  portal: string
  openedByName: string
  closedByName: string | null
  openingAmount: string
  closingAmount: string | null
  expectedAmount: string | null
  openedAt: string
  closedAt: string | null
}

export interface SessionsResult {
  sessions: SerializedSessionHistory[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

export async function getAllSessions(
  filters: SessionHistoryFilters = {}
): Promise<SessionsResult> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const { portal, status, from, to, page = 1 } = filters

  const where: Record<string, unknown> = {}
  if (portal) where.portal = portal
  if (status === "open") where.closedAt = null
  if (status === "closed") where.closedAt = { not: null }
  if (from || to) {
    const openedAt: Record<string, Date> = {}
    if (from) openedAt.gte = new Date(from)
    if (to) openedAt.lte = new Date(to)
    where.openedAt = openedAt
  }

  const [sessions, total] = await Promise.all([
    prisma.caisseSession.findMany({
      where,
      orderBy: { openedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        openedBy: { select: { name: true } },
      },
    }),
    prisma.caisseSession.count({ where }),
  ])

  // Batch-fetch closedBy names (relation not defined in schema - use field closedById)
  const closedByIds = sessions
    .map((s) => s.closedById)
    .filter((id): id is string => id !== null)

  const closedByUsers =
    closedByIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: closedByIds } },
          select: { id: true, name: true },
        })
      : []

  const closedByMap = Object.fromEntries(closedByUsers.map((u) => [u.id, u.name]))

  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      portal: s.portal,
      openedByName: s.openedBy.name,
      closedByName: s.closedById ? (closedByMap[s.closedById] ?? null) : null,
      openingAmount: s.openingAmount.toString(),
      closingAmount: s.closingAmount?.toString() ?? null,
      expectedAmount: s.expectedAmount?.toString() ?? null,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  }
}