"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Search } from "lucide-react"
import { Badge }  from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input }  from "@/components/ui/Input"
import { DateText } from "@/components/ui/DateText"
import { formatMAD } from "@/lib/utils/currency"
import { paymentMethodLabel } from "@/lib/utils/labels"
import type { SaleListRow, SalesListResult } from "@/lib/actions/magazin/sales"
import { SaleDetailModal } from "./SaleDetailModal"
import React from "react"

interface Filters { from: string; to: string; q: string; returned: boolean }

interface SalesClientProps {
  result:  SalesListResult
  filters: Filters
  locale:  string
  role:    string
}

/** Shop sales history: find a sale, see what was returned, start a return. */
export function SalesClient({ result, filters, locale, role }: SalesClientProps) {
  const t      = useTranslations("magazin.sales")
  const router = useRouter()
  const [draft, setDraft] = useState<Filters>(filters)
  const [openId, setOpenId] = useState<string | null>(null)

  const go = (next: Filters, page = 1) => {
    const sp = new URLSearchParams()
    if (next.from) sp.set("from", next.from)
    if (next.to) sp.set("to", next.to)
    if (next.q.trim()) sp.set("q", next.q.trim())
    if (next.returned) sp.set("returned", "1")
    if (page > 1) sp.set("page", String(page))
    const qs = sp.toString()
    router.push(`/${locale}/magazin/sales${qs ? `?${qs}` : ""}`)
  }

  const submit = (e: FormEvent) => { e.preventDefault(); go(draft) }
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("title")}</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0", lineHeight: 1.6 }}>
          {t("windowNote", { days: result.windowDays })}
        </p>
      </div>

      {/* Filters */}
      <form
        onSubmit={submit}
        style={{
          display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end",
          background: "var(--surface)", padding: 16, borderRadius: 8, border: "1px solid var(--border)",
        }}
      >
        <div style={{ flex: "1 1 140px", minWidth: 0 }}>
          <Input label={t("from")} type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </div>
        <div style={{ flex: "1 1 140px", minWidth: 0 }}>
          <Input label={t("to")} type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </div>
        <div style={{ flex: "2 1 200px", minWidth: 0 }}>
          <Input label={t("search")} value={draft.q} maxLength={80} placeholder={t("searchPlaceholder")} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", minHeight: 40, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={draft.returned}
            onChange={(e) => { const next = { ...draft, returned: e.target.checked }; setDraft(next); go(next) }}
            style={{ width: 18, height: 18 }}
          />
          {t("onlyReturned")}
        </label>
        <div style={{ display: "flex", gap: 10 }}>
          <Button type="submit" icon={<Search size={14} />}>{t("search")}</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => { const empty = { from: "", to: "", q: "", returned: false }; setDraft(empty); go(empty) }}
          >
            {t("reset")}
          </Button>
        </div>
      </form>

      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{t("count", { count: result.total })}</p>

      {/* List */}
      {result.rows.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0", fontSize: 14, border: "1px solid var(--border)", borderRadius: 10 }}>
          {t("noSales")}
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          {result.rows.map((row, i) => (
            <li key={row.id} style={{ borderBottom: i < result.rows.length - 1 ? "1px solid var(--border)" : "none" }}>
              <SaleRow row={row} onOpen={() => setOpenId(row.id)} />
            </li>
          ))}
        </ul>
      )}

      {/* Pages */}
      {pages > 1 && (
        <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
          <Button variant="secondary" size="sm" disabled={result.page <= 1} onClick={() => go(filters, result.page - 1)}>{t("previous")}</Button>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("pageOf", { page: result.page, pages })}</span>
          <Button variant="secondary" size="sm" disabled={result.page >= pages} onClick={() => go(filters, result.page + 1)}>{t("next")}</Button>
        </div>
      )}

      <SaleDetailModal
        saleId={openId}
        role={role}
        onClose={() => setOpenId(null)}
        onChanged={() => router.refresh()}
      />
    </div>
  )
}

function SaleRow({ row, onOpen }: { row: SaleListRow; onOpen: () => void }) {
  const t = useTranslations("magazin.sales")
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        width: "100%", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        padding: "12px 16px", background: "var(--surface)", border: "none", cursor: "pointer",
        textAlign: "start", color: "var(--text)",
        borderInlineStart: `3px solid ${row.returnState === "none" ? "transparent" : "var(--warning)"}`,
      }}
    >
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflowWrap: "anywhere" }}>{row.summary}</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "3px 0 0" }}>
          <DateText value={row.createdAt} time /> · {row.cashierName} · {paymentMethodLabel(row.paymentMethod)}
          {row.clientName ? ` · ${row.clientName}` : ""} · {t("pieces", { count: row.pieces })}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{formatMAD(row.totalAmount)}</span>
        {row.returnState !== "none" && (
          <>
            <Badge variant="warning" dot>{row.returnState === "full" ? t("stateFull") : t("statePartial")}</Badge>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("returnedValue", { amount: formatMAD(row.returnedValue) })}</span>
          </>
        )}
      </div>
    </button>
  )
}
