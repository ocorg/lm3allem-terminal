"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Undo2 } from "lucide-react"
import { Modal }   from "@/components/ui/Modal"
import { Badge }   from "@/components/ui/Badge"
import { Button }  from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import { DateText } from "@/components/ui/DateText"
import { formatMAD } from "@/lib/utils/currency"
import { paymentMethodLabel, refundMethodLabel, returnKindLabel } from "@/lib/utils/labels"
import { isAdminRole } from "@/lib/permissions"
import { getSaleDetail, type SaleDetail } from "@/lib/actions/magazin/sales"
import { ReturnForm } from "./ReturnForm"
import React from "react"

interface SaleDetailModalProps {
  saleId:    string | null
  role:      string
  onClose:   () => void
  /** a return was saved: the list behind should refresh */
  onChanged: () => void
}

export function SaleDetailModal({ saleId, role, onClose, onChanged }: SaleDetailModalProps) {
  const t = useTranslations("magazin.sales")
  const isAdmin = isAdminRole(role)
  const [detail,  setDetail]  = useState<SaleDetail | null>(null)
  const [error,   setError]   = useState("")
  const [mode,    setMode]    = useState<"view" | "return">("view")
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const [version, setVersion] = useState(0)

  // A different sale was opened: start from its summary (reset during render, not in an effect)
  if (saleId !== loadedFor) {
    setLoadedFor(saleId)
    setDetail(null)
    setError("")
    setMode("view")
  }

  // Load (and reload after a return) the sale; an answer for a sale no longer open is ignored
  useEffect(() => {
    if (!saleId) return
    let current = true
    getSaleDetail(saleId).then((res) => {
      if (!current) return
      if (res.ok) { setDetail(res.data); setError("") }
      else { setDetail(null); setError(res.message || t("loadError")) }
    }, () => { if (current) setError(t("loadError")) })
    return () => { current = false }
  }, [saleId, version, t])

  const remaining = detail ? detail.items.reduce((n, i) => n + i.quantity - i.returnedQuantity, 0) : 0
  const blockedReason = !detail ? null
    : remaining === 0 ? t("allReturned")
    : !detail.tillOpen ? t("tillClosed")
    : !detail.withinWindow && !isAdmin ? t("windowExpiredStaff")
    : null

  return (
    <Modal
      isOpen={!!saleId}
      onClose={onClose}
      title={mode === "return" ? t("formTitle") : t("detailTitle")}
      size="lg"
    >
      {!detail && !error && (
        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><Spinner /></div>
      )}
      {error && <p role="alert" style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}

      {detail && mode === "return" && (
        <ReturnForm
          detail={detail}
          isAdmin={isAdmin}
          onCancel={() => setMode("view")}
          onDone={() => { setMode("view"); onChanged(); setVersion((v) => v + 1) }}
        />
      )}

      {detail && mode === "view" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Sale header */}
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px 16px", margin: 0 }}>
            <Info label={t("soldAt")} value={<DateText value={detail.createdAt} time />} />
            <Info label={t("cashier")} value={detail.cashierName} />
            <Info label={t("method")} value={paymentMethodLabel(detail.paymentMethod)} />
            <Info label={t("total")} value={formatMAD(detail.totalAmount)} />
            {detail.credit && <Info label={t("client")} value={`${detail.credit.clientName}${detail.credit.clientPhone ? ` | ${detail.credit.clientPhone}` : ""}`} />}
            {detail.credit && <Info label={t("debtLeft")} value={formatMAD(detail.credit.balance)} />}
          </dl>

          {/* Items */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {[t("item"), t("qty"), t("returnedQty"), t("price")].map((h) => (
                    <th key={h} scope="col" style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textAlign: "start", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.items.map((i) => (
                  <tr key={i.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 12px", color: "var(--text)" }}>{i.label}</td>
                    <td style={{ padding: "8px 12px" }}>{i.quantity}</td>
                    <td style={{ padding: "8px 12px", color: i.returnedQuantity ? "var(--warning)" : "var(--text-muted)", fontWeight: i.returnedQuantity ? 700 : 400 }}>{i.returnedQuantity}</td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{formatMAD(i.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Return period */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {detail.withinWindow
              ? <Badge variant="success" dot>{t("returnableUntil")} <DateText value={detail.deadline} time /></Badge>
              : <Badge variant="danger" dot>{t("windowExpired", { days: detail.windowDays })}</Badge>}
          </div>
          {!detail.withinWindow && isAdmin && remaining > 0 && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{t("windowExpiredAdmin")}</p>
          )}

          {blockedReason
            ? <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8 }}>{blockedReason}</p>
            : <Button icon={<Undo2 size={16} />} onClick={() => setMode("return")} style={{ alignSelf: "flex-start" }}>{t("startReturn")}</Button>}

          {/* Returns history */}
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text)" }}>{t("history")}</h3>
            {detail.returns.length === 0
              ? <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{t("noReturns")}</p>
              : detail.returns.map((r) => (
                <article key={r.id} style={{ border: "1px solid var(--border)", borderInlineStart: "3px solid var(--warning)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{returnKindLabel(r.kind)}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}><DateText value={r.createdAt} time /></span>
                  </div>
                  <p style={{ fontSize: 13, margin: 0, color: "var(--text)" }}>{r.reason}</p>
                  <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12, color: "var(--text-muted)" }}>
                    {r.items.map((i, k) => (
                      <li key={k}>{i.label} × {i.quantity} | {formatMAD(i.unitPrice)} | {i.restocked ? t("backInStock") : t("damaged")}</li>
                    ))}
                  </ul>
                  <p style={{ fontSize: 12, margin: 0, color: "var(--text)" }}>
                    {t("value")}: {formatMAD(r.totalValue)}
                    {r.debtReduction > 0 ? ` | ${t("debtReduced")}: ${formatMAD(r.debtReduction)}` : ""}
                    {" | "}{r.refundAmount > 0 ? `${t("refunded")}: ${formatMAD(r.refundAmount)} (${refundMethodLabel(r.refundMethod)})` : t("noMoney")}
                  </p>
                  <p style={{ fontSize: 12, margin: 0, color: "var(--text-muted)" }}>
                    {t("by", { name: r.processedByName })} | {t("approvedBy", { name: r.authorizedByName })}
                    {r.afterDeadline ? ` | ${t("afterDeadline")}` : ""}
                  </p>
                </article>
              ))}
          </section>
        </div>
      )}
    </Modal>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <dt style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</dt>
      <dd style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: "2px 0 0", overflowWrap: "anywhere" }}>{value}</dd>
    </div>
  )
}
