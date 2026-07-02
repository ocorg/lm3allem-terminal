import { getDashboardStats, type DashboardStats } from "@/lib/actions/lm3allem/dashboard"
import { DashboardClient } from "@/components/lm3allem/dashboard/DashboardClient"
import React from "react"

const EMPTY_STATS: DashboardStats = {
  totalRevenue:       "0",
  magazinRevenue:     "0",
  costumesRevenue:    "0",
  openRentals:        0,
  activeUsers:        0,
  openCaisseSessions: 0,
  recentActivity:     [],
  lowStockItems:      [],
  revenueTrend:       [],
}

export default async function DashboardPage() {
  let stats: DashboardStats
  try {
    stats = await getDashboardStats()
  } catch (e) {
    console.error("[dashboard] getDashboardStats failed:", e)
    stats = EMPTY_STATS
  }
  return <DashboardClient stats={stats} />
}
