"use client"

import { useState, useEffect } from "react"
import { useRouter }           from "next/navigation"
import { ChevronRight, Plus }  from "lucide-react"
import { useCaisse }           from "@/components/caisse/CaisseProvider"
import { Modal }               from "@/components/ui/Modal"
import { Button }              from "@/components/ui/Button"
import { Input }               from "@/components/ui/Input"
import { Select }              from "@/components/ui/Select"
import { Badge }               from "@/components/ui/Badge"
import { Spinner }             from "@/components/ui/Spinner"
import { toast }               from "@/hooks/useToast"
import { formatMAD }           from "@/lib/utils/currency"
import { getRentalById, advanceRentalStatus, addRentalPayment } from "@/lib/actions/costumes/rentals"
import type { RentalDetail }   from "@/lib/actions/costumes/rentals"
import type { RentalStatus, TransactionType, PaymentMethod } from "@prisma/client"
import React from "react"

// ── Config ─────────────────────────────────────────────────────
const STATUS_ORDER: RentalStatus[] = ["booked", "in_preparation", "ready_for_pickup", "picked_up", "returned", "cleaning", "available"]
const STATUS_LABELS: Record<RentalStatus, string> = {
  booked: "Réservé", in_preparation: "En préparation", ready_for_pickup: "Prêt à retirer",
  picked_up: "Récupéré", returned: "Rendu", cleaning: "Nettoyage", available: "Disponible",
}
const PAYMENT_TYPE_OPTIONS = [
  { value: "rental_payment",    label: "Paiement location"    },
  { value: "remaining_balance", label: "Solde restant"        },
  { value: "deposit_collected", label: "Dépôt de garantie"    },
  { value: "deposit_returned",  label: "Restitution du dépôt" },
]
const PAYMENT_METHOD_OPTIONS = [
  { value: "cash",   label: "Espèces"  },
  { value: "tpe",    label: "TPE"      },
  { value: "banque", label: "Virement" },
]

// ── Component ──────────────────────────────────────────────────
interface Props {
  rentalId: string
  onClose:  () => void
  locale:   string
  role:     string
}

export function RentalDetailModal({ rentalId, onClose, locale, role }: Props) {
  const { session } = useCaisse()
  const router      = useRouter()

  const [rental,       setRental]       = useState<RentalDetail | null>(null)
  const [loadingData,  setLoadingData]  = useState(true)
  const [showPayment,  setShowPayment]  = useState(false)
  const [advancing,    setAdvancing]    = useState(false)
  const isAdmin = role === "admin" || role === "superadmin"

  const load = async () => {
    setLoadingData(true)
    try {
      const data = await getRentalById(rentalId)
      setRental(data)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => { load() }, [rentalId])

  const handleAdvance = async () => {
    if (!rental) return
    setAdvancing(true)
    try {
      const { newStatus } = await advanceRentalStatus(rental.id)
      toast(`Statut: ${STATUS_LABELS[newStatus]}`, "success")
      load(); router.refresh()
    } catch (err: any) {
      toast(err.message ?? "Erreur", "error")
    } finally {
      setAdvancing(false)
    }
  }

  const currentIdx   = rental ? STATUS_ORDER.indexOf(rental.status) : -1
  const canAdvance   = rental && rental.status !== "available"
  const nextStatus   = canAdvance && currentIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIdx + 1] : null

  return (
    <Modal isOpen onClose={onClose} title={rental ? `Location ${rental.kitReference ?? rental.id.slice(0, 8)}` : "Location"} size="xl">
      {loadingData || !rental ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Status stepper */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
            {STATUS_ORDER.map((s, i) => {
              const done    = i < currentIdx
              const current = i === currentIdx
              return (
                <div key={s} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%", fontSize: 10, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: done || current ? "var(--primary)" : "var(--surface-2)",
                      color:      done || current ? "#1a1a1a" : "var(--text-muted)",
                      border:     `2px solid ${done || current ? "var(--primary)" : "var(--border)"}`,
                      flexShrink: 0,
                    }}>{i + 1}</div>
                    <span style={{ fontSize: 9, fontWeight: current ? 700 : 400, color: current ? "var(--text)" : "var(--text-muted)", whiteSpace: "nowrap" }}>{STATUS_LABELS[s]}</span>
                  </div>
                  {i < STATUS_ORDER.length - 1 && <div style={{ width: 24, height: 2, background: done ? "var(--primary)" : "var(--border)", flexShrink: 0, marginBottom: 14 }} />}
                </div>
              )
            })}
          </div>

          {/* Info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InfoBox label="Client" value={`${rental.clientName} · ${rental.clientPhone}`} />
            <InfoBox label="Retrait / Retour" value={`${new Date(rental.scheduledPickupDate).toLocaleDateString("fr-MA")} → ${new Date(rental.scheduledReturnDate).toLocaleDateString("fr-MA")}`} />
            <InfoBox label="Total / Acompte" value={`${formatMAD(rental.totalAmount)} / ${formatMAD(rental.amountPaid)}`} />
            <InfoBox label="Solde" value={<span style={{ color: parseFloat(rental.balance) > 0 ? "var(--warning)" : "var(--success)", fontWeight: 700 }}>{formatMAD(rental.balance)}</span>} />
            <InfoBox label="Garantie" value={rental.guaranteeType} />
            {rental.notes && <InfoBox label="Notes" value={rental.notes} />}
          </div>

          {/* Kit items */}
          {rental.kitItems.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contenu du kit</p>
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                {rental.kitItems.map((ki, i) => (
                  <div key={ki.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: i < rental.kitItems.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ fontSize: 13, color: "var(--text)" }}>{ki.name_fr}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>×{ki.quantity}</span>
                      <Badge variant={ki.returned ? "success" : "default"}>{ki.returned ? "Rendu" : "En cours"}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payments */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Paiements</p>
              <Button size="sm" variant="secondary" icon={<Plus size={12} />} onClick={() => setShowPayment(true)}>Ajouter</Button>
            </div>
            {rental.payments.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucun paiement enregistré</p>
            ) : (
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                {rental.payments.map((p, i) => {
                  const isNeg   = parseFloat(p.amount) < 0
                  return (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: i < rental.payments.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", margin: 0 }}>{PAYMENT_TYPE_OPTIONS.find(o => o.value === p.type)?.label ?? p.type}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>{p.actorName} · {new Date(p.createdAt).toLocaleDateString("fr-MA")}</p>
                      </div>
                      <span style={{ fontWeight: 700, color: isNeg ? "var(--danger)" : "var(--success)" }}>{formatMAD(p.amount)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          {canAdvance && nextStatus && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button icon={<ChevronRight size={14} />} onClick={handleAdvance} loading={advancing}>
                Avancer → {STATUS_LABELS[nextStatus]}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add payment sub-modal */}
      {showPayment && rental && (
        <AddPaymentModal
          rentalId={rental.id}
          sessionId={session.id}
          onClose={() => setShowPayment(false)}
          onSuccess={() => { setShowPayment(false); load(); router.refresh() }}
        />
      )}
    </Modal>
  )
}

// ── Info box helper ────────────────────────────────────────────
function InfoBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{value}</div>
    </div>
  )
}

// ── Add payment modal ──────────────────────────────────────────
function AddPaymentModal({ rentalId, sessionId, onClose, onSuccess }: { rentalId: string; sessionId: string; onClose: () => void; onSuccess: () => void }) {
  const [amount,  setAmount]  = useState("")
  const [type,    setType]    = useState<TransactionType>("rental_payment")
  const [method,  setMethod]  = useState<PaymentMethod>("cash")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  const handleSave = async () => {
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) { setError("Montant invalide"); return }
    setLoading(true)
    try {
      await addRentalPayment({ rentalId, caisseSessionId: sessionId, amount: num, method, type })
      toast("Paiement enregistré", "success")
      onSuccess()
    } catch (err: any) {
      toast(err.message ?? "Erreur", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Ajouter un paiement" size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Select label="Type" value={type} onChange={e => setType(e.target.value as TransactionType)} options={PAYMENT_TYPE_OPTIONS} />
        <Input  label="Montant (MAD)" type="number" value={amount} onChange={e => setAmount(e.target.value)} error={error} />
        <Select label="Mode de paiement" value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} options={PAYMENT_METHOD_OPTIONS} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} loading={loading}>Enregistrer</Button>
        </div>
      </div>
    </Modal>
  )
}