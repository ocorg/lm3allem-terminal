"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Minus, Plus } from "lucide-react"
import { Button }   from "@/components/ui/Button"
import { Select }   from "@/components/ui/Select"
import { Textarea } from "@/components/ui/Textarea"
import { IconButton } from "@/components/ui/IconButton"
import { AdminApprovalModal } from "@/components/caisse/AdminApprovalModal"
import { toast } from "@/hooks/useToast"
import { formatMAD } from "@/lib/utils/currency"
import { refundMethodLabel } from "@/lib/utils/labels"
import { newRequestId } from "@/lib/utils/request-id"
import { isNetworkError } from "@/lib/client/online"
import { splitReturnValue } from "@/lib/returns/window"
import { createSaleReturn, type SaleDetail } from "@/lib/actions/magazin/sales"
import React from "react"

type Kind = "customer_return" | "entry_error"
type Method = "cash" | "tpe" | "banque"

interface Line { quantity: number; restock: boolean }

interface ReturnFormProps {
  detail:   SaleDetail
  isAdmin:  boolean
  onCancel: () => void
  onDone:   () => void | Promise<void>
}

/**
 * The return form. Everything shown here is a preview: the server recomputes every amount, checks
 * the approval, the return period and the quantities, and decides how a correction's money goes back.
 */
export function ReturnForm({ detail, isAdmin, onCancel, onDone }: ReturnFormProps) {
  const t  = useTranslations("magazin.sales")
  const tP = useTranslations("payment")

  const returnable = detail.items.filter((i) => i.quantity > i.returnedQuantity)
  const [kind,   setKind]   = useState<Kind>("customer_return")
  const [lines,  setLines]  = useState<Record<string, Line>>(() =>
    Object.fromEntries(returnable.map((i) => [i.id, { quantity: 0, restock: true }]))
  )
  const [reason, setReason] = useState("")
  const [method, setMethod] = useState<Method>(detail.moneyMethod)
  const [errors, setErrors] = useState<{ items?: string; reason?: string }>({})
  const [saving, setSaving] = useState(false)
  const [askApproval, setAskApproval] = useState(false)
  // one key per attempt: a retry after a network error can never record the return twice
  const [requestId, setRequestId] = useState(() => newRequestId())

  const value = useMemo(
    () => Math.round(returnable.reduce((s, i) => s + (lines[i.id]?.quantity ?? 0) * i.unitPrice, 0) * 100) / 100,
    [returnable, lines]
  )
  const { debtReduction, refund } = splitReturnValue(value, detail.credit?.balance ?? 0)

  // How the money goes back (same rule as the server)
  const effectiveMethod: Method | "none" =
    refund <= 0 ? "none"
    : kind === "entry_error" ? (detail.inOpenTill ? detail.moneyMethod : "none")
    : method
  const cashShort = effectiveMethod === "cash" && detail.drawerCash !== null && refund > detail.drawerCash

  const setQty = (id: string, max: number, q: number) =>
    setLines((prev) => ({ ...prev, [id]: { ...prev[id], quantity: Math.max(0, Math.min(max, q)) } }))

  const returnAll = () =>
    setLines((prev) => Object.fromEntries(returnable.map((i) => [i.id, { ...prev[i.id], quantity: i.quantity - i.returnedQuantity }])))

  const validate = () => {
    const e: typeof errors = {}
    if (value <= 0) e.items = t("pickItems")
    if (reason.trim().length < 2) e.reason = t("reasonRequired")
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const save = async (overrideToken?: string) => {
    setSaving(true)
    try {
      // a return moves money and stock: it is never kept on the device to be sent later
      if (!navigator.onLine) { toast(t("needsConnection"), "error", 8000); return }
      const res = await createSaleReturn({
        requestId,
        saleId:  detail.id,
        kind,
        reason:  reason.trim(),
        refundMethod: kind === "customer_return" ? method : undefined,
        items:   returnable
          .filter((i) => (lines[i.id]?.quantity ?? 0) > 0)
          .map((i) => ({ saleItemId: i.id, quantity: lines[i.id].quantity, restock: lines[i.id].restock })),
        overrideToken,
      })
      if (!res.ok) { toast(res.message || t("error"), "error", 8000); return }
      toast(kind === "entry_error" ? t("successCorrection") : t("success"), "success")
      setRequestId(newRequestId())
      await onDone()
    } catch (err) {
      // same request id on the next try: if the server did save it, it is not saved twice
      toast(isNetworkError(err) ? t("needsConnection") : t("error"), "error", 8000)
    } finally {
      setSaving(false)
    }
  }

  const submit = () => {
    if (!validate()) return
    if (isAdmin) void save()
    else setAskApproval(true)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Kind */}
      <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <legend style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>{t("kind")}</legend>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          {([["customer_return", t("kindCustomer"), t("kindCustomerDesc")], ["entry_error", t("kindError"), t("kindErrorDesc")]] as const).map(([k, label, desc]) => (
            <label
              key={k}
              style={{
                display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                border: `1px solid ${kind === k ? "var(--primary)" : "var(--border)"}`,
                background: kind === k ? "color-mix(in srgb, var(--primary) 6%, var(--surface))" : "var(--surface)",
              }}
            >
              <input type="radio" name="return-kind" value={k} checked={kind === k} onChange={() => setKind(k)} style={{ marginTop: 3, width: 16, height: 16 }} />
              <span>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{label}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{desc}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Items */}
      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{t("whichItems")}</h3>
          <Button type="button" variant="secondary" size="sm" onClick={returnAll}>{t("returnAll")}</Button>
        </div>
        <div style={{ border: `1px solid ${errors.items ? "var(--danger)" : "var(--border)"}`, borderRadius: 8, overflow: "hidden" }}>
          {returnable.map((i, idx) => {
            const left = i.quantity - i.returnedQuantity
            const line = lines[i.id]
            return (
              <div key={i.id} style={{ padding: "10px 12px", borderTop: idx ? "1px solid var(--border)" : "none", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, overflowWrap: "anywhere" }}>{i.label}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatMAD(i.unitPrice)} | {t("remaining", { count: left })}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    <IconButton label={t("decrease")} size="sm" disabled={line.quantity <= 0} onClick={() => setQty(i.id, left, line.quantity - 1)} style={{ border: "none", borderRadius: 0, background: "var(--surface-2)" }}>
                      <Minus size={16} />
                    </IconButton>
                    <span aria-live="polite" style={{ fontSize: 14, fontWeight: 700, minWidth: 36, textAlign: "center", color: "var(--text)" }}>{line.quantity}</span>
                    <IconButton label={t("increase")} size="sm" disabled={line.quantity >= left} onClick={() => setQty(i.id, left, line.quantity + 1)} style={{ border: "none", borderRadius: 0, background: "var(--surface-2)" }}>
                      <Plus size={16} />
                    </IconButton>
                  </div>
                  {line.quantity > 0 && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer", minHeight: 32 }}>
                      <input
                        type="checkbox"
                        checked={line.restock}
                        onChange={(e) => setLines((prev) => ({ ...prev, [i.id]: { ...prev[i.id], restock: e.target.checked } }))}
                        style={{ width: 18, height: 18 }}
                      />
                      {t("restock")}
                    </label>
                  )}
                </div>
                {line.quantity > 0 && !line.restock && (
                  <p style={{ fontSize: 12, color: "var(--danger)", margin: 0 }}>{t("restockOffHint")}</p>
                )}
              </div>
            )
          })}
        </div>
        {errors.items && <p role="alert" style={{ fontSize: 12, color: "var(--danger)", margin: 0 }}>{errors.items}</p>}
      </section>

      <Textarea
        label={t("reason")}
        value={reason}
        maxLength={300}
        rows={2}
        placeholder={t("reasonPlaceholder")}
        onChange={(e) => { setReason(e.target.value); setErrors((x) => ({ ...x, reason: undefined })) }}
        error={errors.reason}
      />

      {kind === "customer_return" && refund > 0 && (
        <Select
          label={t("refundMethod")}
          value={method}
          onChange={(e) => setMethod(e.target.value as Method)}
          options={[
            { value: "cash",   label: tP("cash") },
            { value: "tpe",    label: tP("tpe") },
            { value: "banque", label: tP("banque") },
          ]}
        />
      )}

      {/* Summary */}
      <section aria-label={t("summary")} style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
        <Row label={t("summaryValue")} value={formatMAD(value)} />
        {debtReduction > 0 && <Row label={t("summaryDebt")} value={formatMAD(debtReduction)} />}
        {refund > 0 && (
          <Row
            label={kind === "entry_error" ? t("summaryCorrection") : t("summaryRefund")}
            value={`${formatMAD(refund)} | ${refundMethodLabel(effectiveMethod)}`}
            strong
          />
        )}
        {kind === "entry_error" && refund > 0 && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
            {detail.inOpenTill ? t("correctionSameTill", { method: refundMethodLabel(detail.moneyMethod) }) : t("correctionClosedTill")}
          </p>
        )}
        {effectiveMethod === "cash" && detail.drawerCash !== null && (
          <p style={{ fontSize: 12, color: cashShort ? "var(--danger)" : "var(--text-muted)", margin: 0 }}>
            {t("cashCheck", { amount: formatMAD(detail.drawerCash) })}
          </p>
        )}
      </section>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>{t("back")}</Button>
        <Button onClick={submit} loading={saving} disabled={cashShort}>
          {isAdmin ? t("confirm") : t("confirmWithApproval")}
        </Button>
      </div>

      <AdminApprovalModal
        isOpen={askApproval}
        title={t("approvalTitle")}
        subtitle={t("approvalSubtitle")}
        purpose={{ kind: "return", saleId: detail.id }}
        authorizeLabel={t("approve")}
        cancelLabel={t("cancel")}
        onAuthorized={(token) => { setAskApproval(false); void save(token) }}
        onCancel={() => setAskApproval(false)}
      >
        <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 12px", fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
          <Row label={t("kind")} value={kind === "entry_error" ? t("kindError") : t("kindCustomer")} />
          <Row label={t("summaryValue")} value={formatMAD(value)} />
          {refund > 0 && <Row label={kind === "entry_error" ? t("summaryCorrection") : t("summaryRefund")} value={`${formatMAD(refund)} | ${refundMethodLabel(effectiveMethod)}`} strong />}
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{reason}</p>
        </div>
      </AdminApprovalModal>
    </div>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: "var(--text)", fontWeight: strong ? 700 : 600 }}>{value}</span>
    </div>
  )
}
