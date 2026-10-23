"use client"

import { useTranslations } from "next-intl"
import { AdminApprovalModal } from "@/components/caisse/AdminApprovalModal"
import React from "react"
import { formatMAD } from "@/lib/utils/currency"

export interface BelowMinItem {
  name:           string
  requestedPrice: number
  minPrice:       number
}

interface BelowMinModalProps {
  isOpen:       boolean
  items:        BelowMinItem[]
  /** Receives the short-lived signed override token; the SERVER verifies it when the sale is saved. */
  onAuthorized: (overrideToken: string) => void
  onCancel:     () => void
}

export function BelowMinModal({
  isOpen,
  items,
  onAuthorized,
  onCancel,
}: BelowMinModalProps) {
  const t = useTranslations("belowMin")

  return (
    <AdminApprovalModal
      isOpen={isOpen}
      title={t("title")}
      subtitle={t("subtitle")}
      authorizeLabel={t("authorize")}
      cancelLabel={t("cancel")}
      onAuthorized={onAuthorized}
      onCancel={onCancel}
    >
      {/* Items summary table */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              {[t("item"), t("requestedPrice"), t("minPrice")].map((h) => (
                <th
                  key={h}
                  style={{
                    padding:       "8px 12px",
                    fontSize:      12,
                    fontWeight:    600,
                    color:         "var(--text-muted)",
                    textAlign:     "start",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--text)" }}>
                  {item.name}
                </td>
                <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "var(--danger)" }}>
                  {formatMAD(item.requestedPrice)}
                </td>
                <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-muted)" }}>
                  {formatMAD(item.minPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminApprovalModal>
  )
}
