"use server"

import { auth }   from "@/lib/auth/auth"
import { prisma } from "@/lib/db/prisma"

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
  date:     string   // "Lun", "Mar", etc.
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

// ── Helpers ────────────────────────────────────────────────────
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10) // "YYYY-MM-DD"
}

const DAY_LABELS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]

// ── getDashboardStats ──────────────────────────────────────────
export async function getDashboardStats(): Promise<DashboardStats> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  // 7-day window (today + 6 days prior, starting at midnight)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const [
    magazinSalesAgg,
    costumesSalesAgg,
    costumesRentalsAgg,
    openRentals,
    activeUsers,
    openCaisseSessions,
    recentActivityRaw,
    lowVariants,
    lowCostumes,
    magazinSalesRecent,
    costumesSalesRecent,
    rentalPaymentsRecent,
  ] = await Promise.all([
    prisma.sale.aggregate({ _sum: { totalAmount: true } }),
    prisma.costumeSale.aggregate({ _sum: { totalAmount: true } }),
    prisma.rentalPayment.aggregate({
      where: { type: { not: "deposit_returned" } },
      _sum:  { amount: true },
    }),
    prisma.rental.count({ where: { status: { not: "available" } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.caisseSession.count({ where: { closedAt: null } }),
    prisma.activityLog.findMany({
      take:    10,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } } },
    }),
    prisma.productVariant.findMany({
      where:   { stock: { lte: 2 }, product: { isActive: true } },
      include: { product: { select: { name_fr: true } } },
      take:    20,
    }),
    prisma.costumeItem.findMany({
      where:  { stock: { lte: 2 }, isActive: true },
      select: { id: true, name_fr: true, stock: true },
      take:   20,
    }),
    // 7-day trend — magazin sales
    prisma.sale.findMany({
      where:  { createdAt: { gte: sevenDaysAgo } },
      select: { totalAmount: true, createdAt: true },
    }),
    // 7-day trend — costume sales
    prisma.costumeSale.findMany({
      where:  { createdAt: { gte: sevenDaysAgo } },
      select: { totalAmount: true, createdAt: true },
    }),
    // 7-day trend — rental payments
    prisma.rentalPayment.findMany({
      where:  { createdAt: { gte: sevenDaysAgo }, type: { not: "deposit_returned" } },
      select: { amount: true, createdAt: true },
    }),
  ])

  // ── Totals ─────────────────────────────────────────────────
  const magazinRev  = Number(magazinSalesAgg._sum.totalAmount  ?? 0)
  const costumesRev =
    Number(costumesSalesAgg._sum.totalAmount   ?? 0) +
    Number(costumesRentalsAgg._sum.amount      ?? 0)
  const totalRev = magazinRev + costumesRev

  // ── 7-day trend ────────────────────────────────────────────
  // Build a map: "YYYY-MM-DD" → { magazin, costumes }
  const trendMap: Record<string, { magazin: number; costumes: number }> = {}

  // Initialise all 7 days with zeros
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    trendMap[dayKey(d)] = { magazin: 0, costumes: 0 }
  }

  for (const s of magazinSalesRecent) {
    const k = dayKey(s.createdAt)
    if (trendMap[k]) trendMap[k].magazin += Number(s.totalAmount)
  }
  for (const s of costumesSalesRecent) {
    const k = dayKey(s.createdAt)
    if (trendMap[k]) trendMap[k].costumes += Number(s.totalAmount)
  }
  for (const p of rentalPaymentsRecent) {
    const k = dayKey(p.createdAt)
    if (trendMap[k]) trendMap[k].costumes += Number(p.amount)
  }

  const revenueTrend: RevenueTrendEntry[] = Object.entries(trendMap).map(([iso, vals]) => {
    const dayIndex = new Date(iso + "T12:00:00").getDay()
    return {
      date:     DAY_LABELS_FR[dayIndex],
      magazin:  Math.round(vals.magazin),
      costumes: Math.round(vals.costumes),
    }
  })

  return {
    totalRevenue:       totalRev.toString(),
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
      actorName:  a.actor?.name ?? "—",
      createdAt:  a.createdAt.toISOString(),
    })),
    lowStockItems: [
      ...lowVariants.map((v) => ({
        id:     v.id,
        name:   v.product.name_fr,
        portal: "magazin" as const,
        stock:  v.stock,
      })),
      ...lowCostumes.map((c) => ({
        id:     c.id,
        name:   c.name_fr,
        portal: "costumes" as const,
        stock:  c.stock,
      })),
    ],
    revenueTrend,
  }
}