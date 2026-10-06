"use server"

import { prisma } from "@/lib/db/prisma"
import { requireAdmin } from "@/lib/auth/guard"
import { isTelegramConfigured } from "@/lib/notifications/telegram"
import { sendLowStockReport } from "@/lib/notifications/low-stock-report"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { getOverdueRentals } from "@/lib/rentals/overdue"
import { getLowStock, lowStockLabel } from "@/lib/inventory/low-stock"
import { actorLabel } from "@/lib/utils/actor"

export interface LowStockAlert {
  id: string
  name: string
  portal: "magazin" | "costumes"
  stock: number
}

export interface OverdueRentalAlert {
  id: string
  reference: string
  clientName: string
  clientPhone: string
  balance: string
  scheduledReturnDate: string
  daysOverdue: number
}

export interface UnpaidRentalAlert {
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
  /** kit not returned although the return date has passed */
  overdueRentals: OverdueRentalAlert[]
  /** rentals that still carry an unpaid balance (not cancelled) */
  openRentals: UnpaidRentalAlert[]
  openCaisseSessions: OpenCaisseAlert[]
  unpaidCredits: UnpaidCreditAlert[]
}

export async function getAlerts(): Promise<AlertsData> {
  await requireAdmin()

  const [lowStock, overdue, unpaidRentals, openCaisse, unpaidCredits] =
    await Promise.all([
      getLowStock(),
      getOverdueRentals(),
      prisma.rental.findMany({
        where: { balance: { gt: 0 }, status: { not: "cancelled" } },
        include: {
          client: { select: { name: true } },
          kit: { select: { reference: true } },
        },
        orderBy: { scheduledReturnDate: "asc" },
      }),
      prisma.caisseSession.findMany({
        where: { closedAt: null },
        include: { openedBy: { select: { name: true, role: true } } },
        orderBy: { openedAt: "asc" },
      }),
      prisma.credit.findMany({
        where: { status: { not: "settled" } },
        select: { id: true, clientName: true, clientPhone: true, balance: true },
        orderBy: { balance: "desc" },
      }),
    ])

  return {
    lowStockItems: lowStock.map((e) => ({
      id: e.id,
      name: lowStockLabel(e),
      portal: e.portal,
      stock: e.stock,
    })),
    overdueRentals: overdue.map((r) => ({
      id: r.id,
      reference: r.reference,
      clientName: r.clientName,
      clientPhone: r.clientPhone,
      balance: r.balance,
      scheduledReturnDate: r.scheduledReturnDate.toISOString(),
      daysOverdue: r.daysOverdue,
    })),
    openRentals: unpaidRentals.map((r) => ({
      id: r.id,
      reference: r.kit?.reference ?? "-",
      clientName: r.client.name,
      balance: r.balance.toString(),
      scheduledReturnDate: r.scheduledReturnDate.toISOString(),
      status: r.status,
    })),
    openCaisseSessions: openCaisse.map((s) => ({
      id: s.id,
      portal: s.portal,
      openedByName: actorLabel(s.openedBy),
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

// ── sendLowStockDigest ─────────────────────────────────────────
export async function sendLowStockDigest(): Promise<ActionResult<{ sent: boolean; count: number }>> {
  return run(async () => {
    await requireAdmin()

    if (!isTelegramConfigured()) {
      throw new ActionError("validation", "تيليغرام غير مُعدّ (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)")
    }

    const items = await getLowStock()
    if (items.length === 0) return { sent: false, count: 0 }

    const sent = await sendLowStockReport(items)
    if (!sent) throw new ActionError("server_error", "تعذر الإرسال عبر تيليغرام، تحقق من الإعدادات")

    return { sent: true, count: items.length }
  })
}
