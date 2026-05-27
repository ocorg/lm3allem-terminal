"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/prisma"

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

export async function getLogs(filters: LogFilters = {}): Promise<LogsResult> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const { portal, entityType, actorId, from, to, page = 1 } = filters

  const where: Record<string, unknown> = {}
  if (portal) where.portal = portal
  if (entityType) where.entityType = entityType
  if (actorId) where.actorId = actorId
  if (from || to) {
    const createdAt: Record<string, Date> = {}
    if (from) createdAt.gte = new Date(from)
    if (to) createdAt.lte = new Date(to)
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
      actorName: l.actor?.name ?? "—",
      diff: l.diff,
      createdAt: l.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  }
}

export async function getActors(): Promise<{ id: string; name: string }[]> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  return prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}