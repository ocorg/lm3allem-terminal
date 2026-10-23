"use client"

import { useState, useMemo, useRef, useLayoutEffect, type ReactNode, type CSSProperties } from "react"
import { ChevronUp, ChevronDown, SearchX, ArrowUpDown } from "lucide-react"
import { useTranslations } from "next-intl"
import { Skeleton } from "./Skeleton"
import { SearchBar } from "./SearchBar"
import { Button } from "./Button"
import React from "react"

export interface Column<T> {
  key:       keyof T | string
  label:     string
  render?:   (value: unknown, row: T) => ReactNode
  sortable?: boolean
  width?:    string | number
  align?:    "left" | "center" | "right"
  /** card view: shown as the card's title (default: the first column) */
  primary?:  boolean
  /** card view: a picture, shown beside the title */
  media?:    boolean
  /** card view: leave this column out (e.g. a picture already shown elsewhere) */
  hideInCard?: boolean
  /** card view: shown on its own line at the bottom, without a label (default for a column without a label) */
  actions?:  boolean
}

interface DataTableProps<T extends { id: string }> {
  columns:     Column<T>[]
  data:        T[]
  loading?:    boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  pageSize?:   number
  searchable?: boolean
  searchKeys?: (keyof T)[]
  /** a row shown dimmed (e.g. a switched-off account) */
  isRowMuted?: (row: T) => boolean
}

/**
 * A table that never hides information: when its columns do not fit the space it has (a phone, a
 * tablet, a narrow panel), every row becomes a card with "label: value" lines, so nothing has to be
 * found by sliding sideways. The choice is made by measuring the real space, not the device type.
 */
export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading      = false,
  emptyMessage,
  onRowClick,
  pageSize     = 20,
  searchable   = false,
  searchKeys   = [],
  isRowMuted,
}: DataTableProps<T>) {
  const t = useTranslations("ui")

  const [search,  setSearch]  = useState("")
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page,    setPage]    = useState(1)

  // ── Table or cards: does the table fit? ──────────────
  const boxRef   = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const [compact, setCompact] = useState(false)

  useLayoutEffect(() => {
    const box = boxRef.current, table = tableRef.current
    if (!box || !table) return
    const decide = () => setCompact(table.offsetWidth > box.clientWidth + 1)
    decide()
    const ro = new ResizeObserver(decide)
    ro.observe(box)
    ro.observe(table)
    return () => ro.disconnect()
  }, [])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
    setPage(1)
  }

  const handleSearch = (val: string) => {
    setSearch(val)
    setPage(1)
  }

  const filtered = useMemo(() => {
    if (!searchable || !search.trim()) return data
    const q = search.toLowerCase()
    return data.filter((row) =>
      searchKeys.some((k) =>
        String((row as Record<string, unknown>)[k as string] ?? "").toLowerCase().includes(q)
      )
    )
  }, [data, search, searchable, searchKeys])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sortKey] ?? "")
      const bv = String((b as Record<string, unknown>)[sortKey] ?? "")
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" })
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize])

  const cell = (col: Column<T>, row: T) => {
    const value = (row as Record<string, unknown>)[String(col.key)]
    return col.render ? col.render(value, row) : String(value ?? "")
  }

  const thStyle: CSSProperties = {
    padding:         "10px 16px",
    fontSize:        12,
    fontWeight:      600,
    color:           "var(--text-muted)",
    whiteSpace:      "nowrap",
    userSelect:      "none",
    background:      "var(--surface-2)",
    borderBottom:    "1px solid var(--border)",
  }

  const tdStyle: CSSProperties = {
    padding:         "0 16px",
    fontSize:        13,
    color:           "var(--text)",
    borderBottom:    "1px solid var(--border)",
    height:          48,
  }

  const isActions = (c: Column<T>) => c.actions ?? !c.label
  const mediaCol   = columns.find((c) => c.media && !c.hideInCard)
  const primaryCol = columns.find((c) => c.primary) ?? columns.find((c) => !c.hideInCard && !c.media && !isActions(c))
  const detailCols = columns.filter((c) => c !== primaryCol && c !== mediaCol && !c.hideInCard && !isActions(c))
  const actionCols = columns.filter((c) => !c.hideInCard && isActions(c))
  const sortable   = columns.filter((c) => c.sortable)

  const empty = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "48px 16px" }}>
      <SearchX size={32} style={{ color: "var(--border)" }} />
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
        {emptyMessage ?? t("noResults")}
      </p>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, minWidth: 0 }}>
      {searchable && (
        <div style={{ paddingBottom: 12 }}>
          <SearchBar
            value={search}
            onChange={handleSearch}
            placeholder={t("search")}
          />
        </div>
      )}

      {/* Sorting is still available as cards (the column headers are gone) */}
      {compact && sortable.length > 0 && !loading && paginated.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
            <ArrowUpDown size={14} aria-hidden />
            {t("sortBy")}
            <select
              value={sortKey ?? ""}
              onChange={(e) => { setSortKey(e.target.value || null); setPage(1) }}
              style={{ height: 36, minWidth: 150, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13, paddingInline: 8 }}
            >
              <option value="">-</option>
              {sortable.map((c) => <option key={String(c.key)} value={String(c.key)}>{c.label}</option>)}
            </select>
          </label>
          {sortKey && (
            <Button variant="secondary" size="sm" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} icon={sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}>
              {sortDir === "asc" ? t("ascending") : t("descending")}
            </Button>
          )}
        </div>
      )}

      {/* The table is always laid out (hidden when it does not fit) so its width can be measured */}
      <div
        ref={boxRef}
        aria-hidden={compact || undefined}
        inert={compact || undefined}
        style={compact
          ? { height: 0, overflow: "hidden", visibility: "hidden" }
          : { overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}
      >
        <table
          ref={tableRef}
          style={{
            width:           "100%",
            borderCollapse:  "collapse",
            background:      "var(--surface)",
          }}
        >
          <thead>
            <tr>
              {columns.map((col) => {
                const key = String(col.key)
                const isSorted = sortKey === key
                return (
                  <th
                    key={key}
                    style={{
                      ...thStyle,
                      width:     col.width,
                      textAlign: col.align ?? "start",
                      cursor:    col.sortable ? "pointer" : "default",
                    }}
                    onClick={col.sortable ? () => handleSort(key) : undefined}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {col.label || t("actions")}
                      {col.sortable && (
                        isSorted
                          ? (sortDir === "asc"
                              ? <ChevronUp   size={11} />
                              : <ChevronDown size={11} />)
                          : <ChevronUp size={11} style={{ opacity: 0.25 }} />
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((col) => (
                      <td key={String(col.key)} style={tdStyle}>
                        <Skeleton variant="row" height={18} />
                      </td>
                    ))}
                  </tr>
                ))
              : paginated.length === 0
              ? (
                  <tr>
                    <td colSpan={columns.length} style={{ border: "none" }}>{empty}</td>
                  </tr>
                )
              : paginated.map((row) => (
                  <tr
                    key={row.id}
                    className={onRowClick ? "data-table-row-clickable" : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    style={isRowMuted?.(row) ? { background: "var(--surface-2)" } : undefined}
                  >
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        style={{ ...tdStyle, textAlign: col.align ?? "start" }}
                      >
                        {cell(col, row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Card view */}
      {compact && (
        loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="row" height={88} />)}
          </div>
        ) : paginated.length === 0 ? (
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)" }}>{empty}</div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {paginated.map((row) => (
              <li
                key={row.id}
                className={onRowClick ? "data-table-row-clickable" : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  background:   isRowMuted?.(row) ? "var(--surface-2)" : "var(--surface)",
                  border:       "1px solid var(--border)",
                  borderRadius: 10,
                  padding:      "12px 14px",
                  display:      "flex",
                  flexDirection: "column",
                  gap:          10,
                  minWidth:     0,
                }}
              >
                {(primaryCol || mediaCol) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    {mediaCol && <div style={{ flexShrink: 0 }}>{cell(mediaCol, row)}</div>}
                    {primaryCol && (
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", minWidth: 0, overflowWrap: "anywhere" }}>
                        {cell(primaryCol, row)}
                      </div>
                    )}
                  </div>
                )}
                {detailCols.length > 0 && (
                  <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px 14px" }}>
                    {detailCols.map((col) => (
                      <div key={String(col.key)} style={{ minWidth: 0 }}>
                        <dt style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>{col.label}</dt>
                        <dd style={{ margin: 0, fontSize: 13, color: "var(--text)", overflowWrap: "anywhere" }}>{cell(col, row)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {actionCols.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                    {actionCols.map((col) => <React.Fragment key={String(col.key)}>{cell(col, row)}</React.Fragment>)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      {!loading && totalPages > 1 && (
        <div
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            flexWrap:       "wrap",
            gap:            10,
            paddingTop:     12,
            fontSize:       13,
            color:          "var(--text-muted)",
          }}
        >
          <span>
            {t("page")} {page} {t("of")} {totalPages}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              {t("previous")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
