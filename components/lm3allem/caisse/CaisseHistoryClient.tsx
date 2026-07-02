"use client"

import { useRouter, useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Select } from "@/components/ui/Select"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { formatMAD } from "@/lib/utils/currency"
import { formatDate } from "@/lib/utils/date"
import type { SessionsResult } from "@/lib/actions/lm3allem/caisse"
import React from "react"

const PORTAL_VARIANT: Record<string, "primary" | "info" | "success"> = {
  magazin:  "primary",
  costumes: "info",
  lm3allem: "success",
}

interface Props {
  result: SessionsResult
  filters: Record<string, string | undefined>
}

export function CaisseHistoryClient({ result, filters }: Props) {
  const t  = useTranslations("lm3allem.caisse")
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  function push(newFilters: Record<string, string | undefined>) {
    const merged = { ...filters, ...newFilters, page: "1" }
    const sp = new URLSearchParams()
    Object.entries(merged).forEach(([k, v]) => { if (v) sp.set(k, v) })
    router.push(`/${locale}/lm3allem/caisse?${sp.toString()}`)
  }

  const totalPages = Math.ceil(result.total / result.pageSize)

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Select
          label={t("allPortals")}
          value={filters.portal ?? ""}
          onChange={(e) => push({ portal: e.target.value || undefined })}
          style={{ minWidth: "160px" }}
          options={[
            { value: "", label: t("allPortals") },
            { value: "magazin", label: "Magazin" },
            { value: "costumes", label: "Costumes" },
          ]}
        />
        <Select
          label={t("allStatuses")}
          value={filters.status ?? ""}
          onChange={(e) => push({ status: e.target.value || undefined })}
          style={{ minWidth: "160px" }}
          options={[
            { value: "", label: t("allStatuses") },
            { value: "open", label: t("open") },
            { value: "closed", label: t("closed") },
          ]}
        />
        <Input
          label={t("openedAt")}
          type="date"
          value={filters.from?.slice(0, 10) ?? ""}
          onChange={(e) => push({ from: e.target.value || undefined })}
        />
        <Input
          label=""
          type="date"
          value={filters.to?.slice(0, 10) ?? ""}
          onChange={(e) => push({ to: e.target.value || undefined })}
        />
      </div>

      {/* Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
        {result.sessions.length === 0
          ? <p style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>{t("noSessions")}</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {[t("portalColumn"), t("openedBy"), t("openedAt"), t("openingAmount"), t("closingAmount"), t("expectedAmount"), t("difference"), t("allStatuses")].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "start", fontWeight: 600, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.sessions.map((s, i) => {
                  const diff = s.closingAmount && s.expectedAmount
                    ? Number(s.closingAmount) - Number(s.expectedAmount)
                    : null
                  const isOpen = !s.closedAt
                  return (
                    <tr key={s.id} style={{ borderBottom: i < result.sessions.length - 1 ? "1px solid var(--border)" : "none", borderInlineStart: `3px solid ${isOpen ? "var(--warning)" : "var(--border)"}` }}>
                      <td style={{ padding: "12px 16px" }}><Badge variant={PORTAL_VARIANT[s.portal] ?? "default"}>{s.portal}</Badge></td>
                      <td style={{ padding: "12px 16px" }}>{s.openedByName}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{formatDate(s.openedAt)}</td>
                      <td style={{ padding: "12px 16px" }}>{formatMAD(s.openingAmount)}</td>
                      <td style={{ padding: "12px 16px" }}>{s.closingAmount ? formatMAD(s.closingAmount) : "-"}</td>
                      <td style={{ padding: "12px 16px" }}>{s.expectedAmount ? formatMAD(s.expectedAmount) : "-"}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: diff === null ? "var(--text-muted)" : diff >= 0 ? "var(--success)" : "var(--danger)" }}>
                        {diff === null ? "-" : formatMAD(diff.toString())}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <Badge variant={isOpen ? "warning" : "success"}>{isOpen ? t("open") : t("closed")}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        }
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              variant={p === result.page ? "primary" : "secondary"}
              size="sm"
              onClick={() => push({ page: p.toString() })}
            >
              {p}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}