import { getFinancesData } from "@/lib/actions/lm3allem/finances"
import { FinancesClient } from "@/components/lm3allem/finances/FinancesClient"

function currentMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  return { from: from.toISOString(), to: to.toISOString() }
}

export default async function FinancesPage() {
  const data = await getFinancesData(currentMonthRange())
  return <FinancesClient initialData={data} />
}