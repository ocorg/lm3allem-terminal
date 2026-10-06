"use client"

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
import { actionLabel } from "@/lib/utils/action-labels"
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
            ...PORTALS.map((p) => ({ value: p, label: p })),
          ]}
        />
        <Select
          label={t("entityType")}
          value={currentFilters.entityType ?? ""}
          onChange={(e) => push({ entityType: e.target.value || undefined })}
          style={{ minWidth: "150px" }}
          options={[
            { value: "", label: "-" },
            ...entityTypes.map((e) => ({ value: e, label: e })),
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

      {/* Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
        {result.logs.length === 0
          ? <p style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>{t("noLogs")}</p>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {[t("at"), t("by"), t("action"), t("entity"), "Portal"].map((h, i) => (
                    <th key={i} style={{ padding: "10px 16px", textAlign: "start", fontWeight: 600, fontSize: 12, color: "var(--text-muted)",borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.logs.map((l, i) => (
                  <tr key={l.id} style={{ borderBottom: i < result.logs.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "10px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}><DateText value={l.createdAt} time /></td>
                    <td style={{ padding: "10px 16px", fontWeight: 500 }}>{l.actorName}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <div>{actionLabel(l.action)}</div>
                      <code style={{ fontSize: 12, background: "var(--surface-2)", padding: "1px 5px", borderRadius: "4px", color: "var(--text-muted)" }}>{l.action}</code>
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--text-muted)" }}>{l.entityType} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>#{l.entityId.slice(-6)}</span></td>
                    <td style={{ padding: "10px 16px" }}><Badge variant={PORTAL_VARIANT[l.portal] ?? "default"}>{portalLabel(l.portal)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

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