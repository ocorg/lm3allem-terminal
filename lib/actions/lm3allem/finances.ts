"use server"

import { prisma } from "@/lib/db/prisma"
import { requireAdmin } from "@/lib/auth/guard"
import { ActionError } from "@/lib/actions/result"
import { getRevenueRows } from "@/lib/finance/revenue"
import { round2, toNum } from "@/lib/utils/money"
import { endOfDay, monthKey, startOfDay } from "@/lib/utils/time"

export interface DateRange {
  /** "YYYY-MM-DD" (Morocco time) */
  from: string
  to: string
}

export interface MonthlyData {
  month: string // "YYYY-MM"
  magazinSales: string
  costumesSales: string
  rentalRevenue: string
  expenses: string
  net: string
}

export interface FinancesData {
  monthly: MonthlyData[]
  totals: {
    magazinSales: string
    costumesSales: string
    rentalRevenue: string
    expenses: string
    net: string
  }
}

const MAX_MONTHS = 36

export async function getFinancesData(range: DateRange): Promise<FinancesData> {
  await requireAdmin()

  const from = startOfDay(range.from)
  const to   = endOfDay(range.to)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw new ActionError("validation")

  const [revenue, expenses] = await Promise.all([
    getRevenueRows({ from, to }),
    prisma.expense.findMany({
      where:  { date: { gte: from, lte: to } },
      select: { amount: true, date: true },
    }),
  ])

  type Bucket = { magazinSales: number; costumesSales: number; rentalRevenue: number; expenses: number }
  const map = new Map<string, Bucket>()
  const ensure = (k: string): Bucket => {
    let b = map.get(k)
    if (!b) { b = { magazinSales: 0, costumesSales: 0, rentalRevenue: 0, expenses: 0 }; map.set(k, b) }
    return b
  }

  revenue.magazin.forEach((r)  => { ensure(monthKey(r.at)).magazinSales  += r.amount })
  revenue.costumes.forEach((r) => { ensure(monthKey(r.at)).costumesSales += r.amount })
  revenue.rentals.forEach((r)  => { ensure(monthKey(r.at)).rentalRevenue += r.amount })
  expenses.forEach((e)         => { ensure(monthKey(e.date)).expenses    += toNum(e.amount) })

  // Fill every month of the range (empty ones too: the chart needs continuity)
  const allMonths: string[] = []
  let [y, m] = monthKey(from).split("-").map(Number)
  const [endY, endM] = monthKey(to).split("-").map(Number)
  while ((y < endY || (y === endY && m <= endM)) && allMonths.length < MAX_MONTHS) {
    allMonths.push(`${y}-${String(m).padStart(2, "0")}`)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }

  const empty: Bucket = { magazinSales: 0, costumesSales: 0, rentalRevenue: 0, expenses: 0 }
  const monthly: MonthlyData[] = allMonths.map((month) => {
    const b = map.get(month) ?? empty
    const net = b.magazinSales + b.costumesSales + b.rentalRevenue - b.expenses
    return {
      month,
      magazinSales:  round2(b.magazinSales).toString(),
      costumesSales: round2(b.costumesSales).toString(),
      rentalRevenue: round2(b.rentalRevenue).toString(),
      expenses:      round2(b.expenses).toString(),
      net:           round2(net).toString(),
    }
  })

  const sums = monthly.reduce(
    (acc, m) => ({
      magazinSales:  acc.magazinSales  + Number(m.magazinSales),
      costumesSales: acc.costumesSales + Number(m.costumesSales),
      rentalRevenue: acc.rentalRevenue + Number(m.rentalRevenue),
      expenses:      acc.expenses      + Number(m.expenses),
      net:           acc.net           + Number(m.net),
    }),
    { magazinSales: 0, costumesSales: 0, rentalRevenue: 0, expenses: 0, net: 0 }
  )

  return {
    monthly,
    totals: {
      magazinSales:  round2(sums.magazinSales).toString(),
      costumesSales: round2(sums.costumesSales).toString(),
      rentalRevenue: round2(sums.rentalRevenue).toString(),
      expenses:      round2(sums.expenses).toString(),
      net:           round2(sums.net).toString(),
    },
  }
}
