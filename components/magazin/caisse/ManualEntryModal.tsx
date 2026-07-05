"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Modal }  from "@/components/ui/Modal"
import { Input }  from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { toast }  from "@/hooks/useToast"
import { addManualEntry } from "@/lib/actions/magazin/caisse"
import React from "react"

interface ManualEntryModalProps {
  isOpen:    boolean
  sessionId: string
  onClose:   () => void
  onSuccess: () => void
}

export function ManualEntryModal({ isOpen, sessionId, onClose, onSuccess }: ManualEntryModalProps) {
  const t    = useTranslations("caisse")
  const tCom = useTranslations("common")

  const [amount,  setAmount]  = useState("")
  const [reason,  setReason]  = useState("")
  const [loading, setLoading] = useState(false)
  const [errors,  setErrors]  = useState<Record<string, string>>({})

  const handleSave = async () => {
    const e: Record<string, string> = {}
    const num = parseFloat(amount)
    if (isNaN(num))         e.amount = tCom("invalidAmount")
    if (!reason.trim())     e.reason = t("reasonRequired")
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    try {
      await addManualEntry(sessionId, num, reason.trim())
      toast(t("entryRecorded"), "success")
      setAmount(""); setReason("")
      onSuccess()
    } catch {
      toast(t("entryError"), "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("manualEntry")} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
          {t("manualEntryInstructions")}
        </p>
        <Input
          label={t("amount")}
          type="number"
          step="0.01"
          value={amount}
          onChange={e => { setAmount(e.target.value); setErrors({}) }}
          error={errors.amount}
          placeholder={t("amountPlaceholder")}
        />
        <Input
          label={t("reason")}
          value={reason}
          onChange={e => { setReason(e.target.value); setErrors({}) }}
          error={errors.reason}
          placeholder={t("reasonPlaceholder")}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>{tCom("cancel")}</Button>
          <Button onClick={handleSave} loading={loading}>{tCom("save")}</Button>
        </div>
      </div>
    </Modal>
  )
}