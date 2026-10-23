"use client"

import { DataTable } from "@/components/ui/DataTable"
import { useRouter, useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Select } from "@/components/ui/Select"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"

const PORTAL_VARIANT: Record<string, "primary" | "info" | "success"> = {
  magazin:  "primary",
  costumes: "info",
  lm3allem: "success",
}
import type { LogsResult } from "@/lib/actions/lm3allem/logs"
import { actionLabel, entityLabel } from "@/lib/utils/action-labels"
import React from "react"
import { DateText } from "@/components/ui/DateText"
import { portalLabel } from "@/lib/utils/labels"

const PORTALS     = ["magazin", "costumes", "lm3allem"]

interface Props {
  result: LogsResult
  actors: { id: string; name: string }[]
  /** entity types that exist in the log (read from the database) */
  entityTypes: string[]
  currentFilters: Record<string, string | undefined>
}

export function LogsClient({ result, actors, entityTypes, currentFilters }: Props) {
  const t = useTranslations("lm3allem.logs")
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  function push(updates: Record<string, string | undefined>) {
    const merged = { ...currentFilters, ...updates, page: "1" }
    const sp = new URLSearchParams()
    Object.entries(merged).forEach(([k, v]) => { if (v) sp.set(k, v) })
    router.push(`/${locale}/lm3allem/logs?${sp.toString()}`)
  }

  function goPage(page: number) {
    const sp = new URLSearchParams()
    Object.entries({ ...currentFilters, page: page.toString() }).forEach(([k, v]) => { if (v) sp.set(k, v) })
    router.push(`/${locale}/lm3allem/logs?${sp.toString()}`)
  }

  const totalPages = Math.ceil(result.total / result.pageSize)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)",margin: 0 }}>
        {t("title")}
      </h1>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", background: "var(--surface)", padding: 16, borderRadius: "8px", border: "1px solid var(--border)" }}>
        <Select
          label={t("allPortals")}
          value={currentFilters.portal ?? ""}
          onChange={(e) => push({ portal: e.target.value || undefined })}
          style={{ minWidth: "140px" }}
          options={[
            { value: "", label: t("allPortals") },
            ...PORTALS.map((p) => ({ value: p, label: portalLabel(p) })),
          ]}
        />
        <Select
          label={t("entityType")}
          value={currentFilters.entityType ?? ""}
          onChange={(e) => push({ entityType: e.target.value || undefined })}
          style={{ minWidth: "150px" }}
          options={[
            { value: "", label: "-" },
            ...entityTypes.map((e) => ({ value: e, label: entityLabel(e) })),
          ]}
        />
        <Select
          label={t("allActors")}
          value={currentFilters.actorId ?? ""}
          onChange={(e) => push({ actorId: e.target.value || undefined })}
          style={{ minWidth: "160px" }}
          options={[
            { value: "", label: t("allActors") },
            ...actors.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
        <Input label={t("from")} type="date" value={currentFilters.from?.slice(0, 10) ?? ""} onChange={(e) => push({ from: e.target.value || undefined })} />
        <Input label={t("to")} type="date" value={currentFilters.to?.slice(0, 10) ?? ""} onChange={(e) => push({ to: e.target.value || undefined })} />
        <Button variant="ghost" size="sm" onClick={() => router.push(`/${locale}/lm3allem/logs`)}>{t("reset")}</Button>
      </div>

      {/* Table (cards when it does not fit) */}
      <DataTable
        data={result.logs}
        emptyMessage={t("noLogs")}
        pageSize={1000}
        columns={[
          { key: "action", label: t("action"), primary: true, render: (_, l) => actionLabel(l.action) },
          { key: "createdAt", label: t("at"), render: (_, l) => <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}><DateText value={l.createdAt} time /></span> },
          { key: "actorName", label: t("by"), render: (_, l) => <span style={{ fontWeight: 500 }}>{l.actorName}</span> },
          { key: "entityType", label: t("entity"), render: (_, l) => <span style={{ color: "var(--text-muted)" }}>{entityLabel(l.entityType)} <span style={{ fontSize: 12 }}>#{l.entityId.slice(-6)}</span></span> },
          { key: "portal", label: t("portal"), render: (_, l) => <Badge variant={PORTAL_VARIANT[l.portal] ?? "default"}>{portalLabel(l.portal)}</Badge> },
        ]}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
          <Button variant="secondary" size="sm" onClick={() => goPage(result.page - 1)} disabled={result.page <= 1}>←</Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p =>
              p === 1 ||
              p === totalPages ||
              Math.abs(p - result.page) <= 2
            )
            .reduce<(number | "…")[]>((acc, p, i, arr) => {
              if (i > 0 && typeof arr[i - 1] === "number" && (p as number) - (arr[i - 1] as number) > 1) acc.push("…")
              acc.push(p)
              return acc
            }, [])
            .map((p, i) =>
              p === "…"
                ? <span key={`ellipsis-${i}`} style={{ color: "var(--text-muted)", fontSize: 13, padding: "0 4px" }}>…</span>
                : <Button key={p} variant={p === result.page ? "primary" : "secondary"} size="sm" onClick={() => goPage(p as number)}>{p}</Button>
            )}
          <Button variant="secondary" size="sm" onClick={() => goPage(result.page + 1)} disabled={result.page >= totalPages}>→</Button>
        </div>
      )}
    </div>
  )
}