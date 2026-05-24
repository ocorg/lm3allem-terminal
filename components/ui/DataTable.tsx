"use client"

import { useState, useMemo, type ReactNode } from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { useTranslations } from "next-intl"
import { Skeleton } from "./Skeleton"
import { SearchBar } from "./SearchBar"
import { Button } from "./Button"

export interface Column<T> {
  key:       keyof T | string
  label:     string
  render?:   (value: unknown, row: T) => ReactNode
  sortable?: boolean
  width?:    string | number
  align?:    "left" | "center" | "right"
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
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading      = false,
  emptyMessage,
  onRowClick,
  pageSize     = 20,
  searchable   = false,
  searchKeys   = [],
}: DataTableProps<T>) {
  const t = useTranslations("ui")

  const [search,  setSearch]  = useState("")
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page,    setPage]    = useState(1)

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

  const thStyle: React.CSSProperties = {
    padding:         "10px 16px",
    fontSize:        11,
    fontWeight:      600,
    color:           "var(--text-muted)",
    textTransform:   "uppercase",
    letterSpacing:   "0.05em",
    whiteSpace:      "nowrap",
    userSelect:      "none",
    background:      "var(--surface-2)",
    borderBottom:    "1px solid var(--border)",
  }

  const tdStyle: React.CSSProperties = {
    padding:         "0 16px",
    fontSize:        13,
    color:           "var(--text)",
    borderBottom:    "1px solid var(--border)",
    height:          48,
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {searchable && (
        <div style={{ paddingBottom: 12 }}>
          <SearchBar
            value={search}
            onChange={handleSearch}
            placeholder={t("search")}
          />
        </div>
      )}

      <div
        style={{
          overflowX:    "auto",
          borderRadius: 8,
          border:       "1px solid var(--border)",
        }}
      >
        <table
          style={{
            width:           "100%",
            borderCollapse:  "collapse",
            background:      "var(--surface)",
            minWidth:        400,
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
                      textAlign: col.align ?? "left",
                      cursor:    col.sortable ? "pointer" : "default",
                    }}
                    onClick={col.sortable ? () => handleSort(key) : undefined}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {col.label}
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
                    <td
                      colSpan={columns.length}
                      style={{
                        ...tdStyle,
                        height:      120,
                        textAlign:   "center",
                        color:       "var(--text-muted)",
                        border:      "none",
                      }}
                    >
                      {emptyMessage ?? t("noResults")}
                    </td>
                  </tr>
                )
              : paginated.map((row) => (
                  <tr
                    key={row.id}
                    className={onRowClick ? "data-table-row-clickable" : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => {
                      const key   = String(col.key)
                      const value = (row as Record<string, unknown>)[key]
                      return (
                        <td
                          key={key}
                          style={{ ...tdStyle, textAlign: col.align ?? "left" }}
                        >
                          {col.render ? col.render(value, row) : String(value ?? "")}
                        </td>
                      )
                    })}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!loading && totalPages > 1 && (
        <div
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            paddingTop:     12,
            fontSize:       13,
            color:          "var(--text-muted)",
          }}
        >
          <span>
            {t("page")} {page} {t("of")} {totalPages}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
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