"use client"

import { useTranslations } from "next-intl"
import { StatCard } from "@/components/ui/StatCard"
import { Badge } from "@/components/ui/Badge"
import { formatMAD } from "@/lib/utils/currency"
import { formatRelative } from "@/lib/utils/date"
import type { DashboardStats } from "@/lib/actions/lm3allem/dashboard"

export function DashboardClient({ stats }: { stats: DashboardStats }) {
  const t = useTranslations("lm3allem.dashboard")

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
        <StatCard label={t("stats.totalRevenue")}    value={formatMAD(stats.totalRevenue)}    trend="up" />
        <StatCard label={t("stats.magazinRevenue")}  value={formatMAD(stats.magazinRevenue)}  trend="neutral" />
        <StatCard label={t("stats.costumesRevenue")} value={formatMAD(stats.costumesRevenue)} trend="neutral" />
        <StatCard label={t("stats.openRentals")}     value={stats.openRentals.toString()} />
        <StatCard label={t("stats.activeUsers")}     value={stats.activeUsers.toString()} />
        <StatCard label={t("stats.openCaisseSessions")} value={stats.openCaisseSessions.toString()} />
      </div>

      {/* Panels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

        {/* Activity */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "1.25rem" }}>
          <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
            {t("recentActivity")}
          </p>
          {stats.recentActivity.length === 0
            ? <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>{t("noActivity")}</p>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                {stats.recentActivity.map((a, i) => (
                  <div key={a.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    padding: "0.625rem 0",
                    borderBottom: i < stats.recentActivity.length - 1 ? "1px solid var(--border)" : "none",
                  }}>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "var(--text)" }}>{a.action}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        {a.actorName} · <Badge variant="default">{a.portal}</Badge>
                      </div>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap", marginInlineStart: "1rem" }}>
                      {formatRelative(a.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {/* Low Stock */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "1.25rem" }}>
          <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
            {t("lowStockItems")}
          </p>
          {stats.lowStockItems.length === 0
            ? <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>{t("noLowStock")}</p>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                {stats.lowStockItems.map((item, i) => (
                  <div key={item.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0.625rem 0",
                    borderBottom: i < stats.lowStockItems.length - 1 ? "1px solid var(--border)" : "none",
                    borderInlineStart: `3px solid ${item.stock === 0 ? "var(--danger)" : "var(--warning)"}`,
                    paddingInlineStart: "0.75rem",
                  }}>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "var(--text)" }}>{item.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>{item.portal}</div>
                    </div>
                    <Badge variant={item.stock === 0 ? "danger" : "warning"}>
                      {item.stock === 0 ? "Épuisé" : `${item.stock}`}
                    </Badge>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}