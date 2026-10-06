"use server"

import { prisma } from "@/lib/db/prisma"
import { requireAdmin } from "@/lib/auth/guard"
import { getRevenueRows, getRevenueTotals } from "@/lib/finance/revenue"
import { getLowStock, lowStockLabel } from "@/lib/inventory/low-stock"
import { toNum } from "@/lib/utils/money"
import { dayKey, startOfDay } from "@/lib/utils/time"

export interface ActivityEntry {
  id:         string
  portal:     string
  entityType: string
  entityId:   string
  action:     string
  actorName:  string
  createdAt:  string
}

export interface LowStockItem {
  id:     string
  name:   string
  portal: "magazin" | "costumes"
  stock:  number
}

export interface RevenueTrendEntry {
  date:     string   // short weekday label
  magazin:  number
  costumes: number
}

export interface DashboardStats {
  totalRevenue:       string
  magazinRevenue:     string
  costumesRevenue:    string
  openRentals:        number
  activeUsers:        number
  openCaisseSessions: number
  recentActivity:     ActivityEntry[]
  lowStockItems:      LowStockItem[]
  revenueTrend:       RevenueTrendEntry[]
}

const DAY_LABELS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]

/** Rentals that still need attention: from booking until the kit is back in the shop. */
const OPEN_RENTAL_STATUSES = ["booked", "in_preparation", "ready_for_pickup", "picked_up"] as const

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireAdmin()

  // 7-day window in Morocco time (today + 6 days prior)
  const days: string[] = []
  for (let i = 6; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * 86_400_000)))
  const window = { from: startOfDay(days[0]), to: new Date() }

  const [
    totals,
    openRentals,
    activeUsers,
    openCaisseSessions,
    recentActivityRaw,
    lowStock,
    trendRows,
  ] = await Promise.all([
    getRevenueTotals(),
    prisma.rental.count({ where: { status: { in: [...OPEN_RENTAL_STATUSES] } } }),
    // the invisible ghost account is never counted
    prisma.user.count({ where: { isActive: true, role: { not: "ghost" } } }),
    prisma.caisseSession.count({ where: { closedAt: null } }),
    prisma.activityLog.findMany({
      where:   { actor: { role: { not: "ghost" } } },
      take:    10,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } } },
    }),
    getLowStock(20),
    getRevenueRows(window),
  ])

  const magazinRev  = totals.magazin
  const costumesRev = toNum(totals.costumes + totals.rentals)

  // ── 7-day trend, bucketed by Morocco day ───────────────────
  const trendMap = new Map<string, { magazin: number; costumes: number }>(
    days.map((d) => [d, { magazin: 0, costumes: 0 }])
  )
  for (const r of trendRows.magazin)  { const b = trendMap.get(dayKey(r.at)); if (b) b.magazin  += r.amount }
  for (const r of trendRows.costumes) { const b = trendMap.get(dayKey(r.at)); if (b) b.costumes += r.amount }
  for (const r of trendRows.rentals)  { const b = trendMap.get(dayKey(r.at)); if (b) b.costumes += r.amount }

  const revenueTrend: RevenueTrendEntry[] = [...trendMap.entries()].map(([iso, vals]) => ({
    date:     DAY_LABELS[new Date(iso + "T12:00:00Z").getUTCDay()],
    magazin:  Math.round(vals.magazin),
    costumes: Math.round(vals.costumes),
  }))

  return {
    totalRevenue:       toNum(magazinRev + costumesRev).toString(),
    magazinRevenue:     magazinRev.toString(),
    costumesRevenue:    costumesRev.toString(),
    openRentals,
    activeUsers,
    openCaisseSessions,
    recentActivity: recentActivityRaw.map((a) => ({
      id:         a.id,
      portal:     a.portal,
      entityType: a.entityType,
      entityId:   a.entityId,
      action:     a.action,
      actorName:  a.actor?.name ?? "-",
      createdAt:  a.createdAt.toISOString(),
    })),
    lowStockItems: lowStock.map((e) => ({
      id:     e.id,
      name:   lowStockLabel(e),
      portal: e.portal,
      stock:  e.stock,
    })),
    revenueTrend,
  }
}
