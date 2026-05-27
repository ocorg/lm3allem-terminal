import { getDashboardStats } from "@/lib/actions/lm3allem/dashboard"
import { DashboardClient } from "@/components/lm3allem/dashboard/DashboardClient"

export default async function DashboardPage() {
  const stats = await getDashboardStats()
  return <DashboardClient stats={stats} />
}