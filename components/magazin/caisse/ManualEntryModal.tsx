"use client"

import { useState } from "react"
import { Modal }  from "@/components/ui/Modal"
import { Input }  from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { toast }  from "@/hooks/useToast"
import { addManualEntry } from "@/lib/actions/magazin/caisse"

interface ManualEntryModalProps {
  isOpen:    boolean
  sessionId: string
  onClose:   () => void
  onSuccess: () => void
}

export function ManualEntryModal({ isOpen, sessionId, onClose, onSuccess }: ManualEntryModalProps) {
  const [amount,  setAmount]  = useState("")
  const [reason,  setReason]  = useState("")
  const [loading, setLoading] = useState(false)
  const [errors,  setErrors]  = useState<Record<string, string>>({})

  const handleSave = async () => {
    const e: Record<string, string> = {}
    const num = parseFloat(amount)
    if (isNaN(num))         e.amount = "Montant invalide"
    if (!reason.trim())     e.reason = "Motif requis"
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    try {
      await addManualEntry(sessionId, num, reason.trim())
      toast("Entrée enregistrée", "success")
      setAmount(""); setReason("")
      onSuccess()
    } catch {
      toast("Erreur lors de l'enregistrement", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Entrée manuelle" size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
          Montant positif = entrée de fonds.&nbsp; Montant négatif = dépense ou sortie.
        </p>
        <Input
          label="Montant (MAD)"
          type="number"
          step="0.01"
          value={amount}
          onChange={e => { setAmount(e.target.value); setErrors({}) }}
          error={errors.amount}
          placeholder="ex: -50 ou 200"
        />
        <Input
          label="Motif *"
          value={reason}
          onChange={e => { setReason(e.target.value); setErrors({}) }}
          error={errors.reason}
          placeholder="ex: Achat sacs, Remboursement client..."
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Annuler</Button>
          <Button onClick={handleSave} loading={loading}>Enregistrer</Button>
        </div>
      </div>
    </Modal>
  )
}