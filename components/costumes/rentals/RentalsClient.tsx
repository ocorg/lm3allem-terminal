"use client"

import { useState }             from "react"
import { Plus, Eye }            from "lucide-react"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Badge }                from "@/components/ui/Badge"
import { Button }               from "@/components/ui/Button"
import { formatMAD }            from "@/lib/utils/currency"
import { RentalWizard }         from "./RentalWizard"
import { RentalDetailModal }    from "./RentalDetailModal"
import type { RentalForList }   from "@/lib/actions/costumes/rentals"
import type { CostumeItemForRental }   from "@/lib/actions/costumes/rentals"
import type { LookupById }             from "@/lib/actions/costumes/pos"
import type { ClientForList }   from "@/lib/actions/costumes/clients"
import type { LookupItem }      from "@/lib/actions/costumes/pos"
import type { RentalStatus }    from "@prisma/client"

// ── Types ──────────────────────────────────────────────────────
interface Props {
  rentals:               RentalForList[]
  costumeItems:          CostumeItemForRental[]
  clients:               ClientForList[]
  measurementCategories: LookupItem[]
  lookupById:            LookupById
  role:                  string
  locale:                string
}

const STATUS_LABELS: Record<RentalStatus, string> = {
  booked:           "Réservé",
  in_preparation:   "En préparation",
  ready_for_pickup: "Prêt à retirer",
  picked_up:        "Récupéré",
  returned:         "Rendu",
  cleaning:         "Nettoyage",
  available:        "Disponible",
}

const STATUS_VARIANT: Record<RentalStatus, "primary" | "warning" | "success" | "default" | "danger"> = {
  booked:           "primary",
  in_preparation:   "warning",
  ready_for_pickup: "warning",
  picked_up:        "success",
  returned:         "success",
  cleaning:         "default",
  available:        "success",
}

const ALL_STATUSES = Object.keys(STATUS_LABELS) as RentalStatus[]

// ── Component ──────────────────────────────────────────────────
export function RentalsClient({ rentals, costumeItems, clients, measurementCategories, lookupById, role, locale }: Props) {
  const [statusFilter, setStatusFilter] = useState<RentalStatus | null>(null)
  const [showWizard,   setShowWizard]   = useState(false)
  const [detailId,     setDetailId]     = useState<string | null>(null)

  const filtered = statusFilter ? rentals.filter(r => r.status === statusFilter) : rentals

  const columns: Column<RentalForList>[] = [
    {
      key: "kitReference", label: "Kit",
      render: (_, row) => <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{row.kitReference ?? "—"}</span>,
    },
    {
      key: "clientName", label: "Client", sortable: true,
      render: (_, row) => (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{row.clientName}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>{row.clientPhone}</p>
        </div>
      ),
    },
    {
      key: "status", label: "Statut",
      render: (_, row) => <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABELS[row.status]}</Badge>,
    },
    {
      key: "scheduledPickupDate", label: "Retrait",
      render: (_, row) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(row.scheduledPickupDate).toLocaleDateString("fr-MA")}</span>,
    },
    {
      key: "balance", label: "Solde",
      render: (_, row) => {
        const bal = parseFloat(row.balance)
        return <span style={{ fontWeight: 600, color: bal > 0 ? "var(--warning)" : "var(--success)" }}>{formatMAD(bal)}</span>
      },
    },
    {
      key: "id", label: "", width: 40,
      render: (_, row) => (
        <button onClick={() => setDetailId(row.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
          <Eye size={15} />
        </button>
      ),
    },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Locations</h1>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowWizard(true)}>Nouvelle location</Button>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", marginBottom: 16, paddingBottom: 2 }}>
        <StatusChip label={`Toutes (${rentals.length})`} active={!statusFilter} onClick={() => setStatusFilter(null)} />
        {ALL_STATUSES.map(s => {
          const count = rentals.filter(r => r.status === s).length
          if (!count) return null
          return <StatusChip key={s} label={`${STATUS_LABELS[s]} (${count})`} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
        })}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchable
        searchKeys={["clientName", "clientPhone", "kitReference"]}
        emptyMessage="Aucune location."
      />

      {/* Wizard */}
      <RentalWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        costumeItems={costumeItems}
        clients={clients}
        measurementCategories={measurementCategories}
        lookupById={lookupById}
        locale={locale}
      />

      {/* Detail */}
      {detailId && (
        <RentalDetailModal
          rentalId={detailId}
          onClose={() => setDetailId(null)}
          locale={locale}
          role={role}
        />
      )}
    </div>
  )
}

function StatusChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: active ? 600 : 500,
      cursor: "pointer", whiteSpace: "nowrap",
      border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
      background: active ? "color-mix(in srgb,var(--primary) 12%,transparent)" : "transparent",
      color: active ? "var(--primary)" : "var(--text-muted)", transition: "all 0.15s",
    }}>{label}</button>
  )
}