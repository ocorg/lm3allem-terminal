import { useTranslations } from "next-intl"
import { formatMAD, formatSignedMAD }      from "@/lib/utils/currency"
import { formatRelative } from "@/lib/utils/date"
import type { TransactionEntry } from "@/lib/actions/magazin/caisse"
import React from "react"
import { paymentMethodLabel } from "@/lib/utils/labels"

export function TransactionList({ transactions }: { transactions: TransactionEntry[] }) {
  const t = useTranslations("caisse")
  if (transactions.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px 0", fontSize: 13 }}>
        {t("noTransactions")}
      </div>
    )
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
          {t("recentTransactions")}
        </span>
      </div>

      {transactions.map((tx, i) => {
        const amount = parseFloat(tx.amount)
        const isNeg  = amount < 0
        const accent = tx.type === "sale" ? "var(--primary)" : isNeg ? "var(--danger)" : "var(--success)"
        const nonCash = tx.method === "tpe" || tx.method === "banque"

        return (
          <div
            key={tx.id}
            style={{
              display:              "flex",
              alignItems:           "center",
              gap:                  12,
              padding:              "12px 16px",
              borderBottom:         i < transactions.length - 1 ? "1px solid var(--border)" : "none",
              borderInlineStart:    `3px solid ${accent}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{tx.label}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                {tx.actorName}
                {tx.method ? ` · ${paymentMethodLabel(tx.method)}` : ""}{nonCash ? " (خارج الصندوق)" : ""}
                {" · "}{formatRelative(tx.createdAt)}
              </p>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: isNeg ? "var(--danger)" : "var(--text)", flexShrink: 0 }}>
              {formatSignedMAD(amount)}
            </span>
          </div>
        )
      })}
    </div>
  )
}