"use server"

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { requireAdmin } from "@/lib/auth/guard"
import { endOfDay, startOfDay } from "@/lib/utils/time"

export interface LogFilters {
  portal?: string
  entityType?: string
  actorId?: string
  from?: string
  to?: string
  page?: number
}

export interface SerializedLog {
  id: string
  portal: string
  entityType: string
  entityId: string
  action: string
  actorId: string
  actorName: string
  diff: unknown
  createdAt: string
}

export interface LogsResult {
  logs: SerializedLog[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 30

/** The ghost account never writes log rows, and any that exist are filtered out as well. */
const NOT_GHOST: Prisma.ActivityLogWhereInput = { actor: { role: { not: "ghost" } } }

export async function getLogs(filters: LogFilters = {}): Promise<LogsResult> {
  await requireAdmin()

  const { portal, entityType, actorId, from, to } = filters
  const page = Number.isFinite(filters.page) && (filters.page as number) > 0 ? Math.floor(filters.page as number) : 1

  const where: Prisma.ActivityLogWhereInput = { ...NOT_GHOST }
  if (portal === "magazin" || portal === "costumes" || portal === "lm3allem") where.portal = portal
  if (entityType) where.entityType = entityType
  if (actorId) where.actorId = actorId
  if (from || to) {
    const createdAt: Prisma.DateTimeFilter = {}
    if (from) createdAt.gte = startOfDay(from)
    if (to) createdAt.lte = endOfDay(to)
    where.createdAt = createdAt
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true } } },
    }),
    prisma.activityLog.count({ where }),
  ])

  return {
    logs: logs.map((l) => ({
      id: l.id,
      portal: l.portal,
      entityType: l.entityType,
      entityId: l.entityId,
      action: l.action,
      actorId: l.actorId,
      actorName: l.actor?.name ?? "-",
      diff: l.diff,
      createdAt: l.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  }
}

/** People who can appear in the "by" filter: everyone except the invisible ghost account. */
export async function getActors(): Promise<{ id: string; name: string }[]> {
  await requireAdmin()

  return prisma.user.findMany({
    where:   { role: { not: "ghost" } },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

/** Entity types that actually exist in the log (the filter no longer relies on a hardcoded list). */
export async function getLogEntityTypes(): Promise<string[]> {
  await requireAdmin()

  const rows = await prisma.activityLog.groupBy({ by: ["entityType"], orderBy: { entityType: "asc" } })
  return rows.map((r) => r.entityType)
}
