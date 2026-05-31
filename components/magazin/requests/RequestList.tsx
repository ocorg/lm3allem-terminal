"use client"

import { useState }  from "react"
import { useRouter } from "next/navigation"
import { Plus }      from "lucide-react"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Badge }     from "@/components/ui/Badge"
import { Button }    from "@/components/ui/Button"
import { Modal }     from "@/components/ui/Modal"
import { Input }     from "@/components/ui/Input"
import { Select }    from "@/components/ui/Select"
import { toast }     from "@/hooks/useToast"
import { createRequest, updateRequestStatus } from "@/lib/actions/magazin/requests"
import { formatDate } from "@/lib/utils/date"
import { useTranslations } from "next-intl"
import type { ProductRequestForList } from "@/lib/actions/magazin/requests"

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

export function RequestList({ requests, categories, role }: RequestListProps) {
  const t      = useTranslations("magazin.requests")
  const tCom   = useTranslations("common")
  const router  = useRouter()
  const isAdmin = role === "admin" || role === "superadmin"
  const lookupMap = Object.fromEntries(categories.map(l => [l.id, l]))

  const [statusFilter, setStatusFilter] = useState("all")
  const [showForm,     setShowForm]     = useState(false)
  const [prodName,     setProdName]     = useState("")
  const [catId,        setCatId]        = useState("")
  const [notes,        setNotes]        = useState("")
  const [loading,      setLoading]      = useState(false)
  const [nameError,    setNameError]    = useState("")

  const filtered = statusFilter === "all" ? requests : requests.filter(r => r.status === statusFilter)

  const handleCreate = async () => {
    if (!prodName.trim()) { setNameError("Requis"); return }
    setLoading(true)
    try {
      await createRequest(prodName.trim(), catId || null, notes || undefined)
      toast("Demande enregistrée", "success")
      setShowForm(false); setProdName(""); setCatId(""); setNotes("")
      router.refresh()
    } catch {
      toast("Erreur", "error")
    } finally {
      setLoading(false)
    }
  }

  const handleStatus = async (id: string, status: "pending" | "reviewed" | "ordered") => {
    try {
      await updateRequestStatus(id, status)
      toast("Statut mis à jour", "success")
      router.refresh()
    } catch {
      toast("Erreur", "error")
    }
  }

  const columns: Column<ProductRequestForList>[] = [
    {
      key: "productName", label: t("productName"), sortable: true,
      render: (v) => <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{v as string}</span>,
    },
    {
      key: "categoryId", label: "Catégorie",
      render: (v) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{v ? (lookupMap[v as string]?.label_fr ?? "—") : "—"}</span>,
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
        return <Badge variant={cfg?.variant ?? "default"}>{cfg ? t(cfg.labelKey as any) : String(v)}</Badge>
      },
    },
    { key: "requestedByName", label: t("requestedBy"), render: (v) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{v as string}</span> },
    { key: "createdAt",       label: tCom("date"),      render: (v) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatDate(v as string)}</span> },
    ...(isAdmin ? [{
      key: "id" as keyof ProductRequestForList, label: t("action"),
      render: (_: unknown, row: ProductRequestForList) => (
        <div style={{ display: "flex", gap: 4 }}>
          {row.status === "pending" && (
            <button
              onClick={() => handleStatus(row.id, "reviewed")}
              style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "none", cursor: "pointer", color: "var(--text-muted)" }}
            >
              {t("reviewed")}
            </button>
          )}
          {row.status !== "ordered" && (
            <button
              onClick={() => handleStatus(row.id, "ordered")}
              style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "none", background: "var(--success)", cursor: "pointer", color: "#fff" }}
            >
              {t("ordered")}
            </button>
          )}
        </div>
      ),
    }] : []),
  ]

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
            {t("title")}
          </h1>
          <Button icon={<Plus size={14} />} size="sm" onClick={() => setShowForm(true)}>
            {t("newRequest")}
          </Button>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {[{ v: "all", l: tCom("all") }, { v: "pending", l: t("pending") }, { v: "reviewed", l: t("reviewed") }, { v: "ordered", l: t("ordered") }].map(f => (
            <button key={f.v} onClick={() => setStatusFilter(f.v)} style={{
              padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600,
              cursor: "pointer", border: "none",
              background: statusFilter === f.v ? "var(--primary)" : "var(--surface-2)",
              color:      statusFilter === f.v ? "#1a1a1a"        : "var(--text-muted)",
            }}>
              {f.l}
            </button>
          ))}
        </div>

        <DataTable
          columns={columns as any}
          data={filtered}
          searchable
          searchKeys={["productName"]}
          emptyMessage={t("noRequests")}
        />
      </div>

      {/* New request modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={t("newRequest")} size="sm">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            label={t("productName")}
            value={prodName}
            onChange={e => { setProdName(e.target.value); setNameError("") }}
            error={nameError}
            placeholder="ex: Costume 3 pièces bordeaux"
            autoFocus
          />
          <Select
            label="Catégorie"
            value={catId}
            onChange={e => setCatId(e.target.value)}
            placeholder="Choisir..."
            options={categories.map(c => ({ value: c.id, label: c.label_fr }))}
          />
          <Input
            label="Notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Détails supplémentaires..."
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={loading}>Annuler</Button>
            <Button onClick={handleCreate} loading={loading}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}