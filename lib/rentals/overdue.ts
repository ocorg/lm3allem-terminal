import { prisma } from "@/lib/db/prisma"
import { calendarKey, startOfDay, todayKey } from "@/lib/utils/time"

export interface OverdueRental {
  id: string
  reference: string
  clientName: string
  clientPhone: string
  balance: string
  scheduledReturnDate: Date
  daysOverdue: number
}

/**
 * A rental is overdue when the kit left the shop (picked_up) and its scheduled return day is over.
 * "Day over" is judged in Morocco time: a kit due today is not overdue until tomorrow.
 */
export async function getOverdueRentals(): Promise<OverdueRental[]> {
  const today = todayKey()
  const todayStart = startOfDay(today)

  const rentals = await prisma.rental.findMany({
    where: { status: "picked_up", scheduledReturnDate: { lt: todayStart } },
    include: {
      client: { select: { name: true, phone: true } },
      kit:    { select: { reference: true } },
    },
    orderBy: { scheduledReturnDate: "asc" },
  })

  return rentals.map((r) => ({
    id:                  r.id,
    reference:           r.kit?.reference ?? "-",
    clientName:          r.client.name,
    clientPhone:         r.client.phone,
    balance:             r.balance.toString(),
    scheduledReturnDate: r.scheduledReturnDate,
    daysOverdue:         Math.max(1, Math.round((Date.parse(today) - Date.parse(calendarKey(r.scheduledReturnDate))) / 86_400_000)),
  }))
}
