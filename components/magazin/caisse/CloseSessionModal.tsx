"use client"

import { useState, useEffect } from "react"
import { Modal }         from "@/components/ui/Modal"
import { Input }         from "@/components/ui/Input"
import { Button }        from "@/components/ui/Button"
import { toast }         from "@/hooks/useToast"
import { closeCaisseSession } from "@/lib/actions/caisse"
import { formatMAD }     from "@/lib/utils/currency"

interface CloseSessionModalProps {
  isOpen:          boolean
  sessionId:       string
  expectedAmount:  number
  onClose:         () => void
  onSuccess:       () => void
}

export function CloseSessionModal({ isOpen, sessionId, expectedAmount, onClose, onSuccess }: CloseSessionModalProps) {
  const [counted, setCounted] = useState("")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  const countedNum   = parseFloat(counted) || 0
  const diff         = countedNum - expectedAmount
  const diffPositive = diff >= 0
  const showDiff     = counted !== "" && !isNaN(countedNum)

  // Reset form state every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setCounted("")
      setError("")
      setLoading(false)
    }
  }, [isOpen])

  const handleClose = async () => {
    const num = parseFloat(counted)
    if (isNaN(num) || num < 0) { setError("Montant invalide"); return }
    setLoading(true)
    try {
      await closeCaisseSession(sessionId, num)
      toast("Caisse clôturée avec succès", "success")
      onSuccess()
    } catch {
      toast("Erreur lors de la clôture", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Clôturer la caisse" size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Expected */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "var(--surface-2)", borderRadius: 8 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Montant théorique</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{formatMAD(expectedAmount)}</span>
        </div>

        <Input
          label="Montant compté (MAD) *"
          type="number"
          min="0"
          step="0.01"
          value={counted}
          onChange={e => { setCounted(e.target.value); setError("") }}
          error={error}
          placeholder="0.00"
          autoFocus
        />

        {/* Difference */}
        {showDiff && (
          <div style={{
            display:        "flex",
            justifyContent: "space-between",
            padding:        "12px 14px",
            background:     `color-mix(in srgb, ${diffPositive ? "var(--success)" : "var(--danger)"} 10%, transparent)`,
            border:         `1px solid color-mix(in srgb, ${diffPositive ? "var(--success)" : "var(--danger)"} 30%, transparent)`,
            borderRadius:   8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: diffPositive ? "var(--success)" : "var(--danger)" }}>
              {diffPositive ? "Excédent" : "Déficit"}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: diffPositive ? "var(--success)" : "var(--danger)" }}>
              {diffPositive ? "+" : ""}{formatMAD(diff)}
            </span>
          </div>
        )}

        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
          Cette action est irréversible. La caisse sera clôturée et une nouvelle session devra être ouverte par un administrateur.
        </p>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Annuler</Button>
          <Button variant="danger" onClick={handleClose} loading={loading}>Confirmer la clôture</Button>
        </div>
      </div>
    </Modal>
  )
}