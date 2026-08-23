"use client"

import { useState, useTransition } from "react"
import { useTranslations }         from "next-intl"
import { ChevronDown, ChevronRight } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts"
import { Button }    from "@/components/ui/Button"
import { StatCard }  from "@/components/ui/StatCard"
import { formatMAD } from "@/lib/utils/currency"
import {
  getFinancesData,
  type FinancesData,
  type DateRange,
  type MonthlyData,
} from "@/lib/actions/lm3allem/finances"
import React from "react"

// ── Chart colours (CSS vars don't resolve inside SVG) ─────────
const C_PRIMARY = "#D4941F"
const C_INFO    = "#4A90D9"
const C_SUCCESS = "#2EBD6E"
const C_DANGER  = "#E84040"

// ── Moroccan month names ───────────────────────────────────────
const ARABIC_MONTHS = [
  "يناير","فبراير","مارس","أبريل","ماي","يونيو",
  "يوليوز","غشت","شتنبر","أكتوبر","نونبر","دجنبر",
]

function monthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-")
  return `${ARABIC_MONTHS[parseInt(month, 10) - 1]} ${year}`
}

// ── Presets (unchanged) ───────────────────────────────────────
const PRESETS = [
  { key: "thisMonth",   getRange: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth(), 1).toISOString(),     to: new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59).toISOString() } } },
  { key: "last3Months", getRange: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth() - 2, 1).toISOString(),  to: new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59).toISOString() } } },
  { key: "last6Months", getRange: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth() - 5, 1).toISOString(),  to: new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59).toISOString() } } },
  { key: "thisYear",    getRange: () => { const n = new Date(); return { from: new Date(n.getFullYear(), 0, 1).toISOString(),                 to: new Date(n.getFullYear(), 11, 31, 23, 59, 59).toISOString() } } },
]

// ── Main component ────────────────────────────────────────────
export function FinancesClient({ initialData }: { initialData: FinancesData }) {
  const t = useTranslations("lm3allem.finances")

  const [data,         setData]         = useState(initialData)
  const [activePreset, setActivePreset] = useState("thisMonth")
  const [isPending,    startTransition] = useTransition()
  const [openMonths,   setOpenMonths]   = useState<Set<string>>(new Set())

  function applyPreset(key: string, range: DateRange) {
    setActivePreset(key)
    setOpenMonths(new Set()) // collapse everything on range change
    startTransition(async () => {
      const fresh = await getFinancesData(range)
      setData(fresh)
    })
  }

  function toggleMonth(month: string) {
    setOpenMonths(prev => {
      const next = new Set(prev)
      if (next.has(month)) next.delete(month)
      else next.add(month)
      return next
    })
  }

  function toggleAll() {
    setOpenMonths(prev =>
      prev.size === data.monthly.length
        ? new Set()
        : new Set(data.monthly.map(m => m.month))
    )
  }

  // Group by year (chronological order preserved)
  const monthsByYear = data.monthly.reduce<Record<string, MonthlyData[]>>((acc, m) => {
    const year = m.month.slice(0, 4)
    if (!acc[year]) acc[year] = []
    acc[year].push(m)
    return acc
  }, {})
  const years     = Object.keys(monthsByYear).sort()
  const multiYear = years.length > 1

  // Chart data (unchanged)
  const chartData = data.monthly.map((m) => ({
    month: m.month.slice(0, 7),
    [t("magazinSales")]:  Number(m.magazinSales),
    [t("costumesSales")]: Number(m.costumesSales),
    [t("rentalRevenue")]: Number(m.rentalRevenue),
    [t("expenses")]:      -Number(m.expenses),
  }))
  const tooltipFormatter = (value: unknown) =>
    formatMAD(Math.abs(Number(value ?? 0)).toString())

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 32 }}>

      {/* ── Header + preset buttons ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
          {t("title")}
        </h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              variant={activePreset === p.key ? "primary" : "secondary"}
              size="sm"
              onClick={() => applyPreset(p.key, p.getRange())}
              loading={isPending && activePreset === p.key}
            >
              {t(p.key as Parameters<typeof t>[0])}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Summary stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
        <StatCard label={t("magazinSales")}  value={formatMAD(data.totals.magazinSales)} />
        <StatCard label={t("costumesSales")} value={formatMAD(data.totals.costumesSales)} />
        <StatCard label={t("rentalRevenue")} value={formatMAD(data.totals.rentalRevenue)} />
        <StatCard label={t("expenses")}      value={formatMAD(data.totals.expenses)} />
        <StatCard label={t("net")}           value={formatMAD(data.totals.net)} trend={Number(data.totals.net) >= 0 ? "up" : "down"} />
      </div>

      {/* ── Bar chart ── */}
      {data.monthly.length === 0
        ? <p style={{ color: "var(--text-muted)" }}>{t("noData")}</p>
        : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 20 }}>
            <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
              {t("monthlyBreakdown")}
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v: number) => `${Math.abs(v / 1000)}k`} />
                <Tooltip
                  formatter={tooltipFormatter}
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13 }}
                />
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

      {/* ── Monthly accordion ── */}
      {data.monthly.length > 0 && (
        <div>

          {/* Section label + expand-all toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
              {t("monthlyBreakdown")}
            </p>
            <button
              onClick={toggleAll}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, color: "var(--text-muted)",
                padding: "4px 8px", borderRadius: 4,
              }}
            >
              {openMonths.size === data.monthly.length ? "طي الكل" : "فتح الكل"}
            </button>
          </div>

          {/* Year sections */}
          <div style={{ display: "flex", flexDirection: "column", gap: multiYear ? 16 : 0 }}>
            {years.map(year => (
              <div key={year}>

                {/* Year header — only when range spans multiple years */}
                {multiYear && (
                  <div style={{
                    padding: "5px 16px",
                    fontSize: 11, fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    color: "var(--text-muted)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderBottom: "none",
                    borderRadius: "8px 8px 0 0",
                  }}>
                    {year}
                  </div>
                )}

                {/* Month rows */}
                <div style={{
                  border: "1px solid var(--border)",
                  borderRadius: multiYear ? "0 0 8px 8px" : 8,
                  overflow: "hidden",
                }}>
                  {monthsByYear[year].map((m, idx) => {
                    const isOpen  = openMonths.has(m.month)
                    const netNum  = Number(m.net)
                    const isLast  = idx === monthsByYear[year].length - 1

                    return (
                      <div
                        key={m.month}
                        style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}
                      >
                        {/* ── Month header row (clickable) ── */}
                        <button
                          onClick={() => toggleMonth(m.month)}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "13px 16px",
                            background: isOpen ? "var(--surface-2)" : "var(--surface)",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "start",
                          }}
                        >
                          {/* Chevron */}
                          <span style={{ color: "var(--text-muted)", flexShrink: 0, display: "flex" }}>
                            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </span>

                          {/* Month name */}
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                            {monthLabel(m.month)}
                          </span>

                          {/* Revenue / expense quick-read */}
                          <span style={{ display: "flex", gap: 16, fontSize: 12 }}>
                            <span style={{ color: C_SUCCESS, fontWeight: 500 }}>
                              ↑ {formatMAD(m.magazinSales !== "0" || m.costumesSales !== "0" || m.rentalRevenue !== "0"
                                  ? (Number(m.magazinSales) + Number(m.costumesSales) + Number(m.rentalRevenue)).toString()
                                  : "0")}
                            </span>
                            <span style={{ color: C_DANGER, fontWeight: 500 }}>
                              ↓ {formatMAD(m.expenses)}
                            </span>
                          </span>

                          {/* Net */}
                          <span style={{
                            fontSize: 14, fontWeight: 700,
                            color: netNum >= 0 ? "var(--success)" : "var(--danger)",
                            minWidth: 90, textAlign: "end", flexShrink: 0,
                          }}>
                            {formatMAD(m.net)}
                          </span>
                        </button>

                        {/* ── Expanded breakdown ── */}
                        {isOpen && (
                          <div style={{
                            background: "var(--surface)",
                            borderTop: "1px solid var(--border)",
                            padding: "14px 20px",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "10px 32px",
                          }}>
                            <BreakdownRow label={t("magazinSales")}  value={m.magazinSales}  dot={C_PRIMARY} />
                            <BreakdownRow label={t("costumesSales")} value={m.costumesSales} dot={C_INFO}    />
                            <BreakdownRow label={t("rentalRevenue")} value={m.rentalRevenue} dot={C_SUCCESS} />
                            <BreakdownRow label={t("expenses")}      value={m.expenses}      dot={C_DANGER}  negative />
                            {/* Net — full width */}
                            <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 2 }}>
                              <BreakdownRow
                                label={t("net")}
                                value={m.net}
                                dot={netNum >= 0 ? "var(--success)" : "var(--danger)"}
                                bold
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Breakdown row ──────────────────────────────────────────────

function BreakdownRow({
  label,
  value,
  dot,
  negative = false,
  bold     = false,
}: {
  label:     string
  value:     string
  dot:       string
  negative?: boolean
  bold?:     boolean
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-muted)" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: dot }}>
        {negative && Number(value) > 0 ? "−" : ""}{formatMAD(value)}
      </span>
    </div>
  )
}