"use client"

import { useState, useEffect }  from "react"
import { useTranslations }      from "next-intl"
import { motion, useReducedMotion, type Variants } from "framer-motion"
import {
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts"
import { StatCard }      from "@/components/ui/StatCard"
import { Skeleton }      from "@/components/ui/Skeleton"
import { Badge }         from "@/components/ui/Badge"
import { formatMAD }     from "@/lib/utils/currency"
import { formatRelative } from "@/lib/utils/date"
import {
  TrendingUp, Store, Shirt, Calendar, Users, Wallet,
} from "lucide-react"
import type { DashboardStats } from "@/lib/actions/lm3allem/dashboard"
import React from "react"

// Recharts can't read CSS vars - hardcode brand colors
const C_MAGAZIN  = "#D4941F"
const C_COSTUMES = "#2EBD6E"

interface TooltipPayloadEntry {
  name:  string
  value: number
  color: string
}

function CustomTooltip({ active, payload, label }: {
  active?:  boolean
  payload?: TooltipPayloadEntry[]
  label?:   string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
      <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--text)" }}>{label}</p>
      {payload.map(e => (
        <p key={e.name} style={{ margin: "2px 0", color: e.color }}>
          {e.name}: {e.value.toLocaleString("fr-MA")} MAD
        </p>
      ))}
    </div>
  )
}

// Animation variants
const containerVariants: Variants = {
  hidden:   {},
  visible:  { transition: { staggerChildren: 0.06 } },
}

const itemVariants: Variants = {
  hidden:   { opacity: 0, y: 16 },
  visible:  { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
}

const chartVariants: Variants = {
  hidden:   { opacity: 0 },
  visible:  { opacity: 1, transition: { duration: 0.4, delay: 0.42 } },
}

export function DashboardClient({ stats }: { stats: DashboardStats }) {
  const t             = useTranslations("lm3allem.dashboard")
  const shouldReduce  = useReducedMotion()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const pieData = [
    { name: "Magazin",  value: Math.round(Number(stats.magazinRevenue)) },
    { name: "Costumes", value: Math.round(Number(stats.costumesRevenue)) },
  ]
  const totalRev = Number(stats.totalRevenue)

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 32 }}>

      {/* ── KPI Grid - staggered StatCards ──────────────── */}
      <motion.div
        variants={shouldReduce ? {} : containerVariants}
        initial={shouldReduce ? false : "hidden"}
        animate="visible"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}
      >
        {[
          { label: t("stats.totalRevenue"),       value: formatMAD(stats.totalRevenue),       numericValue: Number(stats.totalRevenue),       icon: TrendingUp, trend: "up"      as const, currency: true,  delay: 0   },
          { label: t("stats.magazinRevenue"),     value: formatMAD(stats.magazinRevenue),     numericValue: Number(stats.magazinRevenue),     icon: Store,      trend: "neutral" as const, currency: true,  delay: 60  },
          { label: t("stats.costumesRevenue"),    value: formatMAD(stats.costumesRevenue),    numericValue: Number(stats.costumesRevenue),    icon: Shirt,      trend: "neutral" as const, currency: true,  delay: 120 },
          { label: t("stats.openRentals"),        value: stats.openRentals.toString(),        numericValue: stats.openRentals,                icon: Calendar,   trend: undefined,           currency: false, delay: 180 },
          { label: t("stats.activeUsers"),        value: stats.activeUsers.toString(),        numericValue: stats.activeUsers,                icon: Users,      trend: undefined,           currency: false, delay: 240 },
          { label: t("stats.openCaisseSessions"), value: stats.openCaisseSessions.toString(), numericValue: stats.openCaisseSessions,         icon: Wallet,     trend: undefined,           currency: false, delay: 300 },
        ].map((card, i) => (
          <motion.div key={i} variants={shouldReduce ? {} : itemVariants}>
            <StatCard
              label={card.label}
              value={card.value}
              numericValue={card.numericValue}
              icon={card.icon}
              trend={card.trend}
              currency={card.currency}
              delay={card.delay}
              maxValue={card.trend ? totalRev : undefined}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* ── Charts - fade in after stat cards ───────────── */}
      <motion.div
        variants={shouldReduce ? {} : chartVariants}
        initial={shouldReduce ? false : "hidden"}
        animate="visible"
        style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, minHeight: 240 }}
      >
        {/* Area chart */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 20 }}>
          <p style={{ margin: "0 0 1rem", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontFamily: "var(--font-display)" }}>
            {t("revenueTrend")}
          </p>
          {mounted ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={stats.revenueTrend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradMagazin"  x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C_MAGAZIN}  stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C_MAGAZIN}  stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gradCostumes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C_COSTUMES} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C_COSTUMES} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area type="monotone" dataKey="magazin"  name="Magazin"  stroke={C_MAGAZIN}  fill="url(#gradMagazin)"  strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="costumes" name="Costumes" stroke={C_COSTUMES} fill="url(#gradCostumes)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton variant="card" height={180} />
          )}
        </div>

        {/* Pie chart */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, display: "flex", flexDirection: "column" }}>
          <p style={{ margin: "0 0 1rem", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontFamily: "var(--font-display)" }}>
            {t("revenueSplit")}
          </p>
          {mounted ? (
            totalRev === 0 ? (
              <div style={{ height: 150, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Wallet size={28} style={{ color: "var(--border)" }} />
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{t("noData")}</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={46} outerRadius={66} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      <Cell fill={C_MAGAZIN}  />
                      <Cell fill={C_COSTUMES} />
                    </Pie>
                    <Tooltip formatter={(v: unknown) => (typeof v === "number" ? `${v.toLocaleString("fr-MA")} MAD` : String(v))} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto" }}>
                  {pieData.map((entry, i) => {
                    const color = i === 0 ? C_MAGAZIN : C_COSTUMES
                    const pct   = totalRev > 0 ? Math.round((entry.value / totalRev) * 100) : 0
                    return (
                      <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{entry.name}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          ) : (
            <Skeleton variant="card" height={180} />
          )}
        </div>
      </motion.div>

      {/* ── Bottom panels ─────────────────────────────────── */}
      <motion.div
        variants={shouldReduce ? {} : chartVariants}
        initial={shouldReduce ? false : "hidden"}
        animate="visible"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}
      >
        {/* Activity */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 20 }}>
          <p style={{ margin: "0 0 1rem", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontFamily: "var(--font-display)" }}>
            {t("recentActivity")}
          </p>
          {stats.recentActivity.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("noActivity")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {stats.recentActivity.map((a, i) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0.625rem 0", borderBottom: i < stats.recentActivity.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div>
                    <div style={{ fontSize: 14, color: "var(--text)" }}>{a.action}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {a.actorName} · <Badge variant="default">{a.portal}</Badge>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", marginInlineStart: 16 }}>
                    {formatRelative(a.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 20 }}>
          <p style={{ margin: "0 0 1rem", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontFamily: "var(--font-display)" }}>
            {t("lowStockItems")}
          </p>
          {stats.lowStockItems.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("noLowStock")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {stats.lowStockItems.map((item, i) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 0", borderBottom: i < stats.lowStockItems.length - 1 ? "1px solid var(--border)" : "none", borderInlineStart: `3px solid ${item.stock === 0 ? "var(--danger)" : "var(--warning)"}`, paddingInlineStart: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, color: "var(--text)" }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{item.portal}</div>
                  </div>
                  <Badge variant={item.stock === 0 ? "danger" : "warning"}>
                    {item.stock === 0 ? t("outOfStock") : `${item.stock}`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
