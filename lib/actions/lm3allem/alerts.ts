"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/prisma"

export interface LowStockAlert {
  id: string
  name: string
  portal: "magazin" | "costumes"
  stock: number
}

export interface OpenRentalAlert {
  id: string
  reference: string
  clientName: string
  balance: string
  scheduledReturnDate: string
  status: string
}

export interface OpenCaisseAlert {
  id: string
  portal: string
  openedByName: string
  openedAt: string
}

export interface UnpaidCreditAlert {
  id: string
  clientName: string
  clientPhone: string | null
  balance: string
}

export interface AlertsData {
  lowStockItems: LowStockAlert[]
  openRentals: OpenRentalAlert[]
  openCaisseSessions: OpenCaisseAlert[]
  unpaidCredits: UnpaidCreditAlert[]
}

export async function getAlerts(): Promise<AlertsData> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const [lowVariants, lowCostumes, openRentals, openCaisse, unpaidCredits] =
    await Promise.all([
      prisma.productVariant.findMany({
        where: { stock: { lte: 2 }, product: { isActive: true } },
        include: { product: { select: { name_fr: true } } },
      }),
      prisma.costumeItem.findMany({
        where: { stock: { lte: 2 }, isActive: true },
        select: { id: true, name_fr: true, stock: true },
      }),
      prisma.rental.findMany({
        where: { balance: { gt: 0 } },
        include: {
          client: { select: { name: true } },
          kit: { select: { reference: true } },
        },
        orderBy: { scheduledReturnDate: "asc" },
      }),
      prisma.caisseSession.findMany({
        where: { closedAt: null },
        include: { openedBy: { select: { name: true } } },
        orderBy: { openedAt: "asc" },
      }),
      prisma.credit.findMany({
        where: { status: { not: "settled" } },
        select: { id: true, clientName: true, clientPhone: true, balance: true },
        orderBy: { balance: "desc" },
      }),
    ])

  return {
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
    openRentals: openRentals.map((r) => ({
      id: r.id,
      reference: r.kit?.reference ?? "—",
      clientName: r.client.name,
      balance: r.balance.toString(),
      scheduledReturnDate: r.scheduledReturnDate.toISOString(),
      status: r.status,
    })),
    openCaisseSessions: openCaisse.map((s) => ({
      id: s.id,
      portal: s.portal,
      openedByName: s.openedBy.name,
      openedAt: s.openedAt.toISOString(),
    })),
    unpaidCredits: unpaidCredits.map((c) => ({
      id: c.id,
      clientName: c.clientName,
      clientPhone: c.clientPhone ?? null,
      balance: c.balance.toString(),
    })),
  }
}