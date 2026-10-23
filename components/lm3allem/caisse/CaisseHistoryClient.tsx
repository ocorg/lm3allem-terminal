"use client"

import { DataTable } from "@/components/ui/DataTable"
import { useRouter, useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Select } from "@/components/ui/Select"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { formatMAD } from "@/lib/utils/currency"
import type { SessionsResult } from "@/lib/actions/lm3allem/caisse"
import React from "react"
import { DateText } from "@/components/ui/DateText"
import { portalLabel } from "@/lib/utils/labels"

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
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t("title")}</h1>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Select
          label={t("allPortals")}
          value={filters.portal ?? ""}
          onChange={(e) => push({ portal: e.target.value || undefined })}
          style={{ minWidth: "160px" }}
          options={[
            { value: "", label: t("allPortals") },
            { value: "magazin", label: portalLabel("magazin") },
            { value: "costumes", label: portalLabel("costumes") },
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
          label={`${t("openedAt")} | من`}
          type="date"
          value={filters.from?.slice(0, 10) ?? ""}
          onChange={(e) => push({ from: e.target.value || undefined })}
        />
        <Input
          label="إلى"
          type="date"
          value={filters.to?.slice(0, 10) ?? ""}
          onChange={(e) => push({ to: e.target.value || undefined })}
        />
      </div>

      {/* Table (cards when it does not fit) */}
      <DataTable
        data={result.sessions}
        emptyMessage={t("noSessions")}
        pageSize={1000}
        columns={[
          { key: "portal", label: t("portalColumn"), primary: true, render: (_, s) => (
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Badge variant={PORTAL_VARIANT[s.portal] ?? "default"}>{portalLabel(s.portal)}</Badge>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}><DateText value={s.openedAt} /></span>
            </span>
          ) },
          { key: "openedByName", label: t("openedBy") },
          { key: "openingAmount", label: t("openingAmount"), render: (_, s) => formatMAD(s.openingAmount) },
          { key: "closingAmount", label: t("closingAmount"), render: (_, s) => s.closingAmount ? formatMAD(s.closingAmount) : "-" },
          { key: "expectedAmount", label: t("expectedAmount"), render: (_, s) => s.expectedAmount ? formatMAD(s.expectedAmount) : "-" },
          { key: "difference", label: t("difference"), render: (_, s) => {
            const diff = s.closingAmount && s.expectedAmount ? Number(s.closingAmount) - Number(s.expectedAmount) : null
            return <span style={{ fontWeight: 600, color: diff === null ? "var(--text-muted)" : diff >= 0 ? "var(--success)" : "var(--danger)" }}>{diff === null ? "-" : formatMAD(diff.toString())}</span>
          } },
          { key: "closedAt", label: t("allStatuses"), render: (_, s) => !s.closedAt
            ? <Badge variant="warning">{t("open")}</Badge>
            : !s.closedByName && !s.closingAmount
              ? <Badge variant="info">مغلق تلقائيا</Badge>
              : <Badge variant="success">{t("closed")}</Badge> },
        ]}
      />

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