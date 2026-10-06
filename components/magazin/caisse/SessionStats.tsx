"use client"

import { useTranslations } from "next-intl"
import { DollarSign, ShoppingBag, TrendingUp, Hash, CreditCard, Landmark } from "lucide-react"
import { StatCard }  from "@/components/ui/StatCard"
import { formatMAD } from "@/lib/utils/currency"
import type { SessionStats } from "@/lib/actions/magazin/caisse"
import React from "react"

export function SessionStats({ stats }: { stats: SessionStats }) {
  const t = useTranslations("caisse")
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
      <StatCard label={t("openingFund")}    value={formatMAD(stats.openingAmount)} icon={DollarSign}  />
      <StatCard label={t("totalSales")}     value={formatMAD(stats.totalSales)}    icon={ShoppingBag} />
      <StatCard label={t("creditPayments")} value={formatMAD(stats.creditPayments)} icon={CreditCard} />
      <StatCard label={t("manualEntries")}  value={formatMAD(stats.totalManual)}   icon={TrendingUp}  />
      <StatCard label={t("nonCash")}        value={formatMAD(stats.nonCash)}       icon={Landmark}    />
      <StatCard label={t("estimatedTotal")} value={formatMAD(stats.runningTotal)}  icon={Hash}        />
    </div>
  )
}