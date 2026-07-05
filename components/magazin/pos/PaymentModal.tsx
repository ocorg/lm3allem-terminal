"use client"

import { useState, useMemo } from "react"
import { useTranslations } from "next-intl"
import { Modal }     from "@/components/ui/Modal"
import { Input }     from "@/components/ui/Input"
import { Button }    from "@/components/ui/Button"
import { formatMAD } from "@/lib/utils/currency"
import type { CartItem } from "./POSClient"
import React from "react"

interface PaymentModalProps {
  isOpen:    boolean
  cart:      CartItem[]
  locale:    string
  loading:   boolean
  onClose:   () => void
  onConfirm: (method: string, amountPaid: number, isCredit: boolean, clientName?: string, clientPhone?: string) => void
}

export function PaymentModal({ isOpen, cart, loading, onClose, onConfirm }: PaymentModalProps) {
  const tP  = useTranslations("payment")
  const tCom = useTranslations("common")

  const PAYMENT_METHODS = [
    { value: "cash",   label: tP("cash")   },
    { value: "tpe",    label: tP("tpe")    },
    { value: "banque", label: tP("banque") },
    { value: "credit", label: tP("credit") },
  ]

  const totalAmount = useMemo(() => cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [cart])

  const [method,      setMethod]      = useState("cash")
  const [amountStr,   setAmountStr]   = useState(totalAmount.toFixed(2))
  const [clientName,  setClientName]  = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [error,       setError]       = useState("")

  const amountPaid   = parseFloat(amountStr) || 0
  const isCreditMode = method === "credit"
  const change       = method === "cash" ? amountPaid - totalAmount : 0

  const handleConfirm = () => {
    setError("")
    if ((isCreditMode) && !clientName.trim()) {
      setError(tP("clientRequired"))
      return
    }
    if (!isCreditMode && amountPaid < totalAmount) {
      setError(tP("insufficientAmount"))
      return
    }
    onConfirm(method, isCreditMode ? amountPaid : amountPaid, isCreditMode, clientName || undefined, clientPhone || undefined)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tP("title")} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{tP("totalToPay")}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>
            {formatMAD(totalAmount)}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {PAYMENT_METHODS.map(m => (
            <button
              key={m.value}
              onClick={() => { setMethod(m.value); setError("") }}
              style={{
                padding:     "10px 12px",
                borderRadius: 8,
                fontSize:    13,
                fontWeight:  600,
                cursor:      "pointer",
                border:      "2px solid",
                borderColor: method === m.value ? "var(--primary)" : "var(--border)",
                background:  method === m.value ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--surface-2)",
                color:       method === m.value ? "var(--primary)" : "var(--text-muted)",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <Input
          label={isCreditMode ? tP("advancePaid") : tP("amountReceived")}
          type="number"
          min="0"
          step="0.01"
          value={amountStr}
          onChange={e => { setAmountStr(e.target.value); setError("") }}
          placeholder="0.00"
        />

        {method === "cash" && !isNaN(change) && change >= 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "color-mix(in srgb, var(--success) 10%, transparent)", borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 500 }}>{tP("change")}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--success)" }}>{formatMAD(change)}</span>
          </div>
        )}

        {isCreditMode && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 14px", background: "var(--surface-2)", borderRadius: 8 }}>
            <Input
              label={tP("clientName")}
              value={clientName}
              onChange={e => { setClientName(e.target.value); setError("") }}
              placeholder={tP("clientNamePlaceholder")}
            />
            <Input
              label={tP("phone")}
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              placeholder="06..."
            />
          </div>
        )}

        {error && <p style={{ fontSize: 12, color: "var(--danger)", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>{tCom("cancel")}</Button>
          <Button onClick={handleConfirm} loading={loading}>{tP("confirmSale")}</Button>
        </div>
      </div>
    </Modal>
  )
}