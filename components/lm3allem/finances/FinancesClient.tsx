"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts"
import { Button } from "@/components/ui/Button"
import { StatCard } from "@/components/ui/StatCard"
import { formatMAD } from "@/lib/utils/currency"
import { getFinancesData, type FinancesData, type DateRange } from "@/lib/actions/lm3allem/finances"

// Recharts renders inside SVG — CSS variables don't resolve there.
// These values mirror the CSS tokens in globals.css.
const C_PRIMARY = "#D4941F"   // --primary
const C_INFO    = "#4A90D9"   // --info
const C_SUCCESS = "#2EBD6E"   // --success
const C_DANGER  = "#E84040"   // --danger

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
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 32 }}>

      {/* Page header + preset buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
          {t("title")}
        </h1>

      {/* Preset Buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
      </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
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
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: 20 }}>
            <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
              {t("monthlyBreakdown")}
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v: number) => `${Math.abs(v / 1000)}k`} />
                <Tooltip formatter={tooltipFormatter} contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey={t("magazinSales")}  fill={C_PRIMARY} radius={[3,3,0,0]} />
                <Bar dataKey={t("costumesSales")} fill={C_INFO}    radius={[3,3,0,0]} />
                <Bar dataKey={t("rentalRevenue")} fill={C_SUCCESS} radius={[3,3,0,0]} />
                <Bar dataKey={t("expenses")}      fill={C_DANGER}  radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      }

      {/* Monthly Table */}
      {data.monthly.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {["month","magazinSales","costumesSales","rentalRevenue","expenses","net"].map((k) => (
                  <th key={k} style={{ padding: "12px 16px", textAlign: "start", fontWeight: 600, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>
                    {k === "month" ? t("monthColumn") : t(k as any)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.monthly.map((m, i) => (
                <tr key={m.month} style={{ borderBottom: i < data.monthly.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{m.month}</td>
                  <td style={{ padding: "12px 16px" }}>{formatMAD(m.magazinSales)}</td>
                  <td style={{ padding: "12px 16px" }}>{formatMAD(m.costumesSales)}</td>
                  <td style={{ padding: "12px 16px" }}>{formatMAD(m.rentalRevenue)}</td>
                  <td style={{ padding: "12px 16px", color: "var(--danger)" }}>{formatMAD(m.expenses)}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: Number(m.net) >= 0 ? "var(--success)" : "var(--danger)" }}>
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