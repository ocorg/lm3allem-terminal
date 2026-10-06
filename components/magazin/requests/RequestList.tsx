"use client"

import { useState }  from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Plus }      from "lucide-react"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Badge }     from "@/components/ui/Badge"
import { Button }    from "@/components/ui/Button"
import { Modal }     from "@/components/ui/Modal"
import { Input }     from "@/components/ui/Input"
import { CreatableSelect } from "@/components/ui/CreatableSelect"
import { toast }     from "@/hooks/useToast"
import { createRequest, updateRequestStatus } from "@/lib/actions/magazin/requests"
import type { ProductRequestForList } from "@/lib/actions/magazin/requests"
import React from "react"
import { DateText } from "@/components/ui/DateText"

type LookupItem = { id: string; label_fr: string; label_ar: string }

const STATUS_CONFIG_KEYS = {
  pending:  { labelKey: "pending",  variant: "warning" as const },
  reviewed: { labelKey: "reviewed", variant: "info"    as const },
  ordered:  { labelKey: "ordered",  variant: "success" as const },
}

interface RequestListProps {
  requests:   ProductRequestForList[]
  categories: LookupItem[]
  role:       string
  locale?:    string
}

export function RequestList({ requests, categories: initialCategories, role }: RequestListProps) {
  const t      = useTranslations("magazin.requests")
  const tCom   = useTranslations("common")
  const router  = useRouter()
  const isAdmin = role === "admin" || role === "ghost"

  const [categories, setCategories] = useState<{ value: string; label: string }[]>(
    initialCategories.map(c => ({ value: c.id, label: c.label_ar }))
  )
  const lookupMap = Object.fromEntries(initialCategories.map(l => [l.id, l]))

  const [statusFilter, setStatusFilter] = useState("all")
  const [showForm,     setShowForm]     = useState(false)
  const [prodName,     setProdName]     = useState("")
  const [catId,        setCatId]        = useState("")
  const [notes,        setNotes]        = useState("")
  const [loading,      setLoading]      = useState(false)
  const [nameError,    setNameError]    = useState("")

  const filtered = statusFilter === "all" ? requests : requests.filter(r => r.status === statusFilter)

  const handleCreate = async () => {
    if (!prodName.trim()) { setNameError(tCom("required")); return }
    setLoading(true)
    try {
      const res = await createRequest(prodName.trim(), catId || null, notes || undefined)
      if (!res.ok) { toast(res.message || tCom("error"), "error"); return }
      toast(t("requestSaved"), "success")
      setShowForm(false); setProdName(""); setCatId(""); setNotes("")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const handleStatus = async (id: string, status: "pending" | "reviewed" | "ordered") => {
    const res = await updateRequestStatus(id, status)
    if (!res.ok) { toast(res.message || tCom("error"), "error"); return }
    toast(t("statusUpdated"), "success")
    router.refresh()
  }

  const columns: Column<ProductRequestForList>[] = [
    {
      key: "productName", label: t("productName"), sortable: true,
      render: (v) => <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{v as string}</span>,
    },
    {
      key: "categoryId", label: t("category"),
      render: (v) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{v ? (lookupMap[v as string]?.label_ar ?? "-") : "-"}</span>,
    },
    {
      key: "requestCount", label: t("count"), align: "center", sortable: true,
      render: (v) => (
        <span style={{
          fontSize: 14, fontWeight: 700, color: "var(--primary)",
          background: "color-mix(in srgb, var(--primary) 12%, transparent)",
          borderRadius: 999, padding: "2px 10px",
        }}>
          {v as number}
        </span>
      ),
    },
    {
      key: "status", label: tCom("status"), align: "center",
      render: (v) => {
        const cfg = STATUS_CONFIG_KEYS[v as keyof typeof STATUS_CONFIG_KEYS]
        return <Badge variant={cfg?.variant ?? "default"}>{cfg ? t(cfg.labelKey as Parameters<typeof t>[0]) : String(v)}</Badge>
      },
    },
    { key: "requestedByName", label: t("requestedBy"), render: (v) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{v as string}</span> },
    { key: "createdAt",       label: tCom("date"),      render: (v) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}><DateText value={v as string} /></span> },
    ...(isAdmin ? [{
      key: "id" as keyof ProductRequestForList, label: t("action"),
      render: (_: unknown, row: ProductRequestForList) => (
        <div style={{ display: "flex", gap: 10, flexWrap: "nowrap" }}>
          {row.status === "pending" && (
            <Button variant="secondary" size="sm" onClick={() => handleStatus(row.id, "reviewed")}>{t("reviewed")}</Button>
          )}
          {row.status !== "ordered" && (
            <Button variant="primary" size="sm" onClick={() => handleStatus(row.id, "ordered")}>{t("ordered")}</Button>
          )}
        </div>
      ),
    }] : []),
  ]

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)",margin: 0 }}>
            {t("title")}
          </h1>
          <Button icon={<Plus size={14} />} size="sm" onClick={() => setShowForm(true)}>
            {t("newRequest")}
          </Button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[{ v: "all", l: tCom("all") }, { v: "pending", l: t("pending") }, { v: "reviewed", l: t("reviewed") }, { v: "ordered", l: t("ordered") }].map(f => (
            <button key={f.v} onClick={() => setStatusFilter(f.v)} style={{
              padding: "8px 16px", minHeight: 36, borderRadius: 999, fontSize: 12, fontWeight: 600,
              cursor: "pointer", border: "none",
              background: statusFilter === f.v ? "var(--brand)" : "var(--surface-2)",
              color:      statusFilter === f.v ? "var(--on-brand)"        : "var(--text-muted)",
            }}>
              {f.l}
            </button>
          ))}
        </div>

        <DataTable
          columns={columns as Column<ProductRequestForList>[]}
          data={filtered}
          searchable
          searchKeys={["productName"]}
          emptyMessage={t("noRequests")}
        />
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={t("newRequest")} size="sm">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            label={t("productName")}
            value={prodName}
            onChange={e => { setProdName(e.target.value); setNameError("") }}
            error={nameError}
            placeholder={t("productNamePlaceholder")}
            autoFocus
          />
          <CreatableSelect
            label={t("category")}
            value={catId}
            onChange={setCatId}
            onCreated={opt => setCategories(prev => [...prev, opt])}
            onDeleted={id => setCategories(prev => prev.filter(c => c.value !== id))}
            canDelete={isAdmin}
            slug="product_categories"
            placeholder={t("choosePlaceholder")}
            options={categories}
          />
          <Input
            label={t("notes")}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={loading}>{tCom("cancel")}</Button>
            <Button onClick={handleCreate} loading={loading}>{tCom("save")}</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}