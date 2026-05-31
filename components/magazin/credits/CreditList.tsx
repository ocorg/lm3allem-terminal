"use client"

import { useState }     from "react"
import { useRouter }    from "next/navigation"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Badge }        from "@/components/ui/Badge"
import { Button }       from "@/components/ui/Button"
import { Modal }        from "@/components/ui/Modal"
import { Input }        from "@/components/ui/Input"
import { Select }       from "@/components/ui/Select"
import { toast }        from "@/hooks/useToast"
import { addCreditPayment } from "@/lib/actions/magazin/credits"
import { formatMAD }    from "@/lib/utils/currency"
import { formatDate }   from "@/lib/utils/date"
import { useTranslations } from "next-intl"
import type { CreditForList } from "@/lib/actions/magazin/credits"

const STATUS_CONFIG_KEYS = {
  open:    { labelKey: "statusOpen",     variant: "danger"  as const },
  partial: { labelKey: "statusPartial",  variant: "warning" as const },
  settled: { labelKey: "statusSettled",  variant: "success" as const },
}

const PAYMENT_METHODS = [
  { value: "cash",   label: "Espèces"  },
  { value: "tpe",    label: "TPE"      },
  { value: "banque", label: "Virement" },
]

interface CreditListProps {
  credits: CreditForList[]
  role?:   string
  locale?: string
}

export function CreditList({ credits }: CreditListProps) {
  const t      = useTranslations("magazin.credits")
  const tCom   = useTranslations("common")
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState("all")
  const [selected,     setSelected]     = useState<CreditForList | null>(null)
  const [payAmount,    setPayAmount]    = useState("")
  const [payMethod,    setPayMethod]    = useState("cash")
  const [loading,      setLoading]      = useState(false)
  const [payError,     setPayError]     = useState("")

  const filtered = statusFilter === "all" ? credits : credits.filter(c => c.status === statusFilter)

  const openPayment = (row: CreditForList) => {
    if (row.status === "settled") return
    setSelected(row); setPayAmount(""); setPayMethod("cash"); setPayError("")
  }

  const handlePayment = async () => {
    if (!selected) return
    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount <= 0)                           { setPayError("Montant invalide"); return }
    if (amount > parseFloat(selected.balance))                  { setPayError("Montant supérieur au solde"); return }
    setLoading(true)
    try {
      await addCreditPayment(selected.id, amount, payMethod as any)
      toast("Paiement enregistré", "success")
      setSelected(null)
      router.refresh()
    } catch {
      toast("Erreur", "error")
    } finally {
      setLoading(false)
    }
  }

  const columns: Column<CreditForList>[] = [
    {
      key: "clientName", label: t("client"), sortable: true,
      render: (_, row) => (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{row.clientName}</p>
          {row.clientPhone && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "1px 0 0" }}>{row.clientPhone}</p>}
        </div>
      ),
    },
    { key: "totalAmount", label: t("total"),  align: "right", render: (v) => <span style={{ fontSize: 13 }}>{formatMAD(v as string)}</span> },
    { key: "amountPaid",  label: t("paid"),   align: "right", render: (v) => <span style={{ fontSize: 13, color: "var(--success)" }}>{formatMAD(v as string)}</span> },
    {
      key: "balance", label: t("balance"), align: "right", sortable: true,
      render: (v) => <span style={{ fontSize: 13, fontWeight: 700, color: parseFloat(v as string) > 0 ? "var(--danger)" : "var(--text-muted)" }}>{formatMAD(v as string)}</span>,
    },
    {
      key: "status", label: tCom("status"), align: "center",
      render: (v) => {
        const cfg = STATUS_CONFIG_KEYS[v as keyof typeof STATUS_CONFIG_KEYS]
        return <Badge variant={cfg?.variant ?? "default"} dot>{cfg ? t(cfg.labelKey as any) : String(v)}</Badge>
      },
    },
    { key: "createdAt", label: "Date", render: (v) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatDate(v as string)}</span> },
  ]

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>{t("title")}</h1>

        {/* Status filter tabs */}
        <div style={{ display: "flex", gap: 4 }}>
          {[{ v: "all", l: t("filterAll") }, { v: "open", l: t("filterOpen") }, { v: "partial", l: t("filterPartial") }, { v: "settled", l: t("filterSettled") }].map(f => (
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
          columns={columns}
          data={filtered}
          onRowClick={openPayment}
          emptyMessage={t("noCredits")}
        />
      </div>

      {/* Payment modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Enregistrer un paiement" size="sm">
        {selected && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px 14px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{selected.clientName}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
                Solde restant : <strong style={{ color: "var(--danger)" }}>{formatMAD(selected.balance)}</strong>
              </p>
            </div>
            <Input
              label="Montant (MAD) *"
              type="number"
              min="0.01"
              step="0.01"
              value={payAmount}
              onChange={e => { setPayAmount(e.target.value); setPayError("") }}
              error={payError}
              placeholder="0.00"
              autoFocus
            />
            <Select
              label="Méthode"
              value={payMethod}
              onChange={e => setPayMethod(e.target.value)}
              options={PAYMENT_METHODS}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setSelected(null)} disabled={loading}>Annuler</Button>
              <Button onClick={handlePayment} loading={loading}>Confirmer</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}