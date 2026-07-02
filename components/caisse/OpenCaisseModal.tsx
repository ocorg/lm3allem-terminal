"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Modal }  from "@/components/ui/Modal"
import { Input }  from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { openCaisseSession } from "@/lib/actions/caisse"
import { toast } from "@/hooks/useToast"
import type { Portal } from "@prisma/client"
import React from "react"

interface OpenCaisseModalProps {
  portal:  Portal
  isOpen:  boolean
  onClose: () => void
}

export function OpenCaisseModal({ portal, isOpen, onClose }: OpenCaisseModalProps) {
  const t      = useTranslations("caisse")
  const tUi    = useTranslations("ui")
  const router = useRouter()

  const [amount,  setAmount]  = useState("")
  const [error,   setError]   = useState("")
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    setAmount("")
    setError("")
    onClose()
  }

  const handleSubmit = async () => {
    const num = parseFloat(amount)
    if (isNaN(num) || num < 0) {
      setError("Montant invalide. Entrez un nombre ≥ 0.")
      return
    }
    setLoading(true)
    setError("")
    try {
      await openCaisseSession(portal, num)
      toast(t("sessionOpen"), "success")
      handleClose()
      router.refresh()
    } catch {
      setError(tUi("error"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("openSession")}
      size="sm"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Input
          label={t("openingAmount")}
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError("") }}
          error={error}
          placeholder="0.00"
          autoFocus
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            {tUi("cancel")}
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            {tUi("confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  )
}