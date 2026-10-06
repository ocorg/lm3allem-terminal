import { getFinancesData } from "@/lib/actions/lm3allem/finances"
import { FinancesClient } from "@/components/lm3allem/finances/FinancesClient"
import { todayKey } from "@/lib/utils/time"
import React from "react"

function currentMonthRange() {
  const [y, m] = todayKey().split("-").map(Number)
  const pad = (n: number) => String(n).padStart(2, "0")
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay)}` }
}

export default async function FinancesPage() {
  const data = await getFinancesData(currentMonthRange())
  return <FinancesClient initialData={data} />
}
