"use client"

import { useState } from "react"
import { Modal }         from "@/components/ui/Modal"
import { Input }         from "@/components/ui/Input"
import { Button }        from "@/components/ui/Button"
import { toast }         from "@/hooks/useToast"
import { closeCaisseSession } from "@/lib/actions/caisse"
import { formatMAD, formatSignedMAD }     from "@/lib/utils/currency"
import { parseAmount }   from "@/lib/utils/money"
import React from "react"

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

  const parsedCounted = parseAmount(counted)
  const countedNum   = Number.isNaN(parsedCounted) ? 0 : parsedCounted
  const diff         = countedNum - expectedAmount
  const diffPositive = diff >= 0
  const showDiff     = counted !== "" && !Number.isNaN(parsedCounted)

  // Reset form state every time the modal opens (adjusted during render: no effect needed)
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen) { setCounted(""); setError(""); setLoading(false) }
  }

  const handleClose = async () => {
    const num = parseAmount(counted)
    if (isNaN(num) || num < 0) { setError("مبلغ غير صالح"); return }
    setLoading(true)
    try {
      const res = await closeCaisseSession(sessionId, num)
      if (!res.ok) { toast(res.message, "error"); return }
      toast("تم إغلاق الصندوق بنجاح", "success")
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إغلاق الصندوق" size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Expected */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "var(--surface-2)", borderRadius: 8 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>المبلغ النظري (نقدا)</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{formatMAD(expectedAmount)}</span>
        </div>

        <Input
          label="المبلغ المعدود (درهم) *"
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
              {diffPositive ? "فائض" : "عجز"}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: diffPositive ? "var(--success)" : "var(--danger)" }}>
              {formatSignedMAD(diff)}
            </span>
          </div>
        )}

        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
          هذا الإجراء لا رجعة فيه. سيتم إغلاق الصندوق وسيحتاج المسؤول لفتح جلسة جديدة. المبالغ المؤداة بالبطاقة أو التحويل لا تدخل في هذا الحساب.
        </p>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>إلغاء</Button>
          <Button variant="danger" onClick={handleClose} loading={loading}>تأكيد الإغلاق</Button>
        </div>
      </div>
    </Modal>
  )
}