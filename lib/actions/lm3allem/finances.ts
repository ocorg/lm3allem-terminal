"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/prisma"

export interface DateRange {
  from: string // ISO date string
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

export async function getFinancesData(range: DateRange): Promise<FinancesData> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const from = new Date(range.from)
  const to = new Date(range.to)

  const [sales, costumeSales, rentalPayments, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { totalAmount: true, createdAt: true },
    }),
    prisma.costumeSale.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { totalAmount: true, createdAt: true },
    }),
    prisma.rentalPayment.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        type: { not: "deposit_returned" },
      },
      select: { amount: true, createdAt: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: from, lte: to } },
      select: { amount: true, date: true },
    }),
  ])

  // Build map keyed by "YYYY-MM"
  const monthKey = (d: Date) => d.toISOString().slice(0, 7)

  type MonthBucket = {
    magazinSales: number
    costumesSales: number
    rentalRevenue: number
    expenses: number
  }

  const map = new Map<string, MonthBucket>()
  const ensure = (k: string): MonthBucket => {
    if (!map.has(k))
      map.set(k, { magazinSales: 0, costumesSales: 0, rentalRevenue: 0, expenses: 0 })
    return map.get(k)!
  }

  sales.forEach((s) => { ensure(monthKey(s.createdAt)).magazinSales += Number(s.totalAmount) })
  costumeSales.forEach((s) => { ensure(monthKey(s.createdAt)).costumesSales += Number(s.totalAmount) })
  rentalPayments.forEach((r) => { ensure(monthKey(r.createdAt)).rentalRevenue += Number(r.amount) })
  expenses.forEach((e) => { ensure(monthKey(e.date)).expenses += Number(e.amount) })

  // Fill all months in range (even empty ones — needed for chart continuity)
  const allMonths: string[] = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  const endMonth = new Date(to.getFullYear(), to.getMonth(), 1)
  while (cursor <= endMonth) {
    allMonths.push(cursor.toISOString().slice(0, 7))
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const monthly: MonthlyData[] = allMonths.map((month) => {
    const m = map.get(month) ?? { magazinSales: 0, costumesSales: 0, rentalRevenue: 0, expenses: 0 }
    const net = m.magazinSales + m.costumesSales + m.rentalRevenue - m.expenses
    return {
      month,
      magazinSales: m.magazinSales.toString(),
      costumesSales: m.costumesSales.toString(),
      rentalRevenue: m.rentalRevenue.toString(),
      expenses: m.expenses.toString(),
      net: net.toString(),
    }
  })

  const zero = { magazinSales: 0, costumesSales: 0, rentalRevenue: 0, expenses: 0, net: 0 }
  const sums = monthly.reduce(
    (acc, m) => ({
      magazinSales: acc.magazinSales + Number(m.magazinSales),
      costumesSales: acc.costumesSales + Number(m.costumesSales),
      rentalRevenue: acc.rentalRevenue + Number(m.rentalRevenue),
      expenses: acc.expenses + Number(m.expenses),
      net: acc.net + Number(m.net),
    }),
    zero
  )

  return {
    monthly,
    totals: {
      magazinSales: sums.magazinSales.toString(),
      costumesSales: sums.costumesSales.toString(),
      rentalRevenue: sums.rentalRevenue.toString(),
      expenses: sums.expenses.toString(),
      net: sums.net.toString(),
    },
  }
}