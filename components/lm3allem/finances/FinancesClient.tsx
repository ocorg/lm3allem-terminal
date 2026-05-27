"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts"
import { Button } from "@/components/ui/Button"
import { StatCard } from "@/components/ui/StatCard"
import { Spinner } from "@/components/ui/Spinner"
import { formatMAD } from "@/lib/utils/currency"
import { getFinancesData, type FinancesData, type DateRange } from "@/lib/actions/lm3allem/finances"

const PRESETS = [
  { key: "thisMonth",   getRange: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth(), 1).toISOString(), to: new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59).toISOString() } } },
  { key: "last3Months", getRange: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth() - 2, 1).toISOString(), to: new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59).toISOString() } } },
  { key: "last6Months", getRange: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth() - 5, 1).toISOString(), to: new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59).toISOString() } } },
  { key: "thisYear",    getRange: () => { const n = new Date(); return { from: new Date(n.getFullYear(), 0, 1).toISOString(), to: new Date(n.getFullYear(), 11, 31, 23, 59, 59).toISOString() } } },
]

export function FinancesClient({ initialData }: { initialData: FinancesData }) {
  const t = useTranslations("lm3allem.finances")
  const [data, setData] = useState(initialData)
  const [activePreset, setActivePreset] = useState("thisMonth")
  const [isPending, startTransition] = useTransition()

  function applyPreset(key: string, range: DateRange) {
    setActivePreset(key)
    startTransition(async () => {
      const fresh = await getFinancesData(range)
      setData(fresh)
    })
  }

  const chartData = data.monthly.map((m) => ({
    month: m.month.slice(0, 7),
    [t("magazinSales")]:  Number(m.magazinSales),
    [t("costumesSales")]: Number(m.costumesSales),
    [t("rentalRevenue")]: Number(m.rentalRevenue),
    [t("expenses")]:      -Number(m.expenses),
  }))

  const tooltipFormatter = (value: unknown) => formatMAD(Math.abs(Number(value ?? 0)).toString())

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* Preset Buttons */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            variant={activePreset === p.key ? "primary" : "secondary"}
            size="sm"
            onClick={() => applyPreset(p.key, p.getRange())}
            loading={isPending && activePreset === p.key}
          >
            {t(p.key as any)}
          </Button>
        ))}
        {isPending && <Spinner size="sm" />}
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem" }}>
        <StatCard label={t("magazinSales")}  value={formatMAD(data.totals.magazinSales)} />
        <StatCard label={t("costumesSales")} value={formatMAD(data.totals.costumesSales)} />
        <StatCard label={t("rentalRevenue")} value={formatMAD(data.totals.rentalRevenue)} />
        <StatCard label={t("expenses")}      value={formatMAD(data.totals.expenses)} />
        <StatCard label={t("net")}           value={formatMAD(data.totals.net)} trend={Number(data.totals.net) >= 0 ? "up" : "down"} />
      </div>

      {/* Chart */}
      {data.monthly.length === 0
        ? <p style={{ color: "var(--text-muted)" }}>{t("noData")}</p>
        : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "1.25rem" }}>
            <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
              {t("monthlyBreakdown")}
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v: number) => `${Math.abs(v / 1000)}k`} />
                <Tooltip formatter={tooltipFormatter} contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "0.8rem" }} />
                <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
                <Bar dataKey={t("magazinSales")}  fill="var(--primary)"  radius={[3,3,0,0]} />
                <Bar dataKey={t("costumesSales")} fill="var(--info)"     radius={[3,3,0,0]} />
                <Bar dataKey={t("rentalRevenue")} fill="var(--success)"  radius={[3,3,0,0]} />
                <Bar dataKey={t("expenses")}      fill="var(--danger)"   radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      }

      {/* Monthly Table */}
      {data.monthly.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {["month","magazinSales","costumesSales","rentalRevenue","expenses","net"].map((k) => (
                  <th key={k} style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: 600, fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>
                    {k === "month" ? "Mois" : t(k as any)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.monthly.map((m, i) => (
                <tr key={m.month} style={{ borderBottom: i < data.monthly.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--text-muted)" }}>{m.month}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>{formatMAD(m.magazinSales)}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>{formatMAD(m.costumesSales)}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>{formatMAD(m.rentalRevenue)}</td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--danger)" }}>{formatMAD(m.expenses)}</td>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: Number(m.net) >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {formatMAD(m.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}