import { DollarSign, ShoppingBag, TrendingUp, Hash } from "lucide-react"
import { StatCard }  from "@/components/ui/StatCard"
import { formatMAD } from "@/lib/utils/currency"
import type { SessionStats } from "@/lib/actions/magazin/caisse"
import React from "react"

export function SessionStats({ stats }: { stats: SessionStats }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
      <StatCard label="Fond d'ouverture"  value={formatMAD(stats.openingAmount)} icon={DollarSign}  />
      <StatCard label="Total ventes"      value={formatMAD(stats.totalSales)}    icon={ShoppingBag} />
      <StatCard label="Entrées manuelles" value={formatMAD(stats.totalManual)}   icon={TrendingUp}  />
      <StatCard label="Total estimé"      value={formatMAD(stats.runningTotal)}  icon={Hash}        />
    </div>
  )
}