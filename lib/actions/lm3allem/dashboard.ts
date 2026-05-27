"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/prisma"

export interface ActivityEntry {
  id: string
  portal: string
  entityType: string
  entityId: string
  action: string
  actorName: string
  createdAt: string
}

export interface LowStockItem {
  id: string
  name: string
  portal: "magazin" | "costumes"
  stock: number
}

export interface DashboardStats {
  totalRevenue: string
  magazinRevenue: string
  costumesRevenue: string
  openRentals: number
  activeUsers: number
  openCaisseSessions: number
  recentActivity: ActivityEntry[]
  lowStockItems: LowStockItem[]
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

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
  ] = await Promise.all([
    prisma.sale.aggregate({ _sum: { totalAmount: true } }),
    prisma.costumeSale.aggregate({ _sum: { totalAmount: true } }),
    prisma.rentalPayment.aggregate({
      where: { type: { not: "deposit_returned" } },
      _sum: { amount: true },
    }),
    prisma.rental.count({ where: { status: { not: "available" } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.caisseSession.count({ where: { closedAt: null } }),
    prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } } },
    }),
    prisma.productVariant.findMany({
      where: { stock: { lte: 2 }, product: { isActive: true } },
      include: { product: { select: { name_fr: true } } },
      take: 20,
    }),
    prisma.costumeItem.findMany({
      where: { stock: { lte: 2 }, isActive: true },
      select: { id: true, name_fr: true, stock: true },
      take: 20,
    }),
  ])

  const magazinRev = Number(magazinSalesAgg._sum.totalAmount ?? 0)
  const costumesRev =
    Number(costumesSalesAgg._sum.totalAmount ?? 0) +
    Number(costumesRentalsAgg._sum.amount ?? 0)
  const totalRev = magazinRev + costumesRev

  return {
    totalRevenue: totalRev.toString(),
    magazinRevenue: magazinRev.toString(),
    costumesRevenue: costumesRev.toString(),
    openRentals,
    activeUsers,
    openCaisseSessions,
    recentActivity: recentActivityRaw.map((a) => ({
      id: a.id,
      portal: a.portal,
      entityType: a.entityType,
      entityId: a.entityId,
      action: a.action,
      actorName: a.actor?.name ?? "—",
      createdAt: a.createdAt.toISOString(),
    })),
    lowStockItems: [
      ...lowVariants.map((v) => ({
        id: v.id,
        name: v.product.name_fr,
        portal: "magazin" as const,
        stock: v.stock,
      })),
      ...lowCostumes.map((c) => ({
        id: c.id,
        name: c.name_fr,
        portal: "costumes" as const,
        stock: c.stock,
      })),
    ],
  }
}