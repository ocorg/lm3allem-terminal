"use server"

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { requireAdmin } from "@/lib/auth/guard"
import { actorLabel } from "@/lib/utils/actor"
import { endOfDay, startOfDay } from "@/lib/utils/time"

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
  await requireAdmin()

  const { portal, status, from, to } = filters
  const page = Number.isFinite(filters.page) && (filters.page as number) > 0 ? Math.floor(filters.page as number) : 1

  const where: Prisma.CaisseSessionWhereInput = {}
  if (portal === "magazin" || portal === "costumes") where.portal = portal
  if (status === "open") where.closedAt = null
  if (status === "closed") where.closedAt = { not: null }
  if (from || to) {
    const openedAt: Prisma.DateTimeFilter = {}
    if (from) openedAt.gte = startOfDay(from)
    if (to) openedAt.lte = endOfDay(to)
    where.openedAt = openedAt
  }

  const [sessions, total] = await Promise.all([
    prisma.caisseSession.findMany({
      where,
      orderBy: { openedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        openedBy: { select: { name: true, role: true } },
        closedBy: { select: { name: true, role: true } },
      },
    }),
    prisma.caisseSession.count({ where }),
  ])

  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      portal: s.portal,
      openedByName: actorLabel(s.openedBy),
      closedByName: s.closedBy ? actorLabel(s.closedBy) : null,
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
