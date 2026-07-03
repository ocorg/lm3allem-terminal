"use client"

import { useState }              from "react"
import { useRouter }             from "next/navigation"
import { Plus, Lock, DollarSign, ShoppingBag, TrendingUp, Hash } from "lucide-react"
import { useCaisse }             from "@/components/caisse/CaisseProvider"
import { Button }                from "@/components/ui/Button"
import { StatCard }              from "@/components/ui/StatCard"
import { ManualEntryModal }      from "@/components/magazin/caisse/ManualEntryModal"
import { CloseSessionModal }     from "@/components/magazin/caisse/CloseSessionModal"
import { formatMAD }             from "@/lib/utils/currency"
import type { CostumesSessionStats, TransactionEntry } from "@/lib/actions/costumes/caisse"
import React from "react"

interface Props {
  initialStats: CostumesSessionStats
  role:         string
}

export function CostumesCaisseClient({ initialStats, role }: Props) {
  const { session }    = useCaisse()
  const router         = useRouter()
  const isAdmin        = role === "admin" || role === "superadmin"
  const [showManual, setShowManual] = useState(false)
  const [showClose,  setShowClose]  = useState(false)

  return (
    <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>الصندوق</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setShowManual(true)}>
            إدخال يدوي
          </Button>
          {isAdmin && (
            <Button variant="danger" size="sm" icon={<Lock size={14} />} onClick={() => setShowClose(true)}>
              إغلاق الصندوق
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
        <StatCard label="رصيد الافتتاح"   value={formatMAD(initialStats.openingAmount)} icon={DollarSign}  />
        <StatCard label="مبيعات البدلات"    value={formatMAD(initialStats.totalSales)}    icon={ShoppingBag} />
        <StatCard label="مدفوعات الإيجار" value={formatMAD(initialStats.totalRentals)}  icon={TrendingUp}  />
        <StatCard label="إدخالات يدوية"  value={formatMAD(initialStats.totalManual)}   icon={TrendingUp}  />
        <StatCard label="إجمالي الصندوق"       value={formatMAD(initialStats.runningTotal)}  icon={Hash}        />
      </div>

      {/* Transaction list */}
      <CostumesTransactionList transactions={initialStats.transactions} />

      <ManualEntryModal
        isOpen={showManual}
        sessionId={session.id}
        onClose={() => setShowManual(false)}
        onSuccess={() => { setShowManual(false); router.refresh() }}
      />

      {isAdmin && (
        <CloseSessionModal
          isOpen={showClose}
          sessionId={session.id}
          expectedAmount={initialStats.runningTotal}
          onClose={() => setShowClose(false)}
          onSuccess={() => { setShowClose(false); router.refresh() }}
        />
      )}
    </div>
  )
}

// ── Transaction list ───────────────────────────────────────────
function CostumesTransactionList({ transactions }: { transactions: TransactionEntry[] }) {
  if (!transactions.length) return (
    <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px 0", fontSize: 13 }}>
      لا توجد معاملات في هذه الجلسة.
    </div>
  )

  const TYPE_LABEL: Record<string, string> = {
    costume_sale:    "بيع",
    rental_payment:  "إيجار",
    manual:          "يدوي",
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          المعاملات الأخيرة
        </span>
      </div>
      {transactions.map((tx, i) => {
        const amount  = parseFloat(tx.amount)
        const isNeg   = amount < 0
        const accent  = tx.type === "costume_sale" ? "var(--primary)" : isNeg ? "var(--danger)" : "var(--success)"
        return (
          <div key={tx.id} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
            borderBottom: i < transactions.length - 1 ? "1px solid var(--border)" : "none",
            borderInlineStart: `3px solid ${accent}`,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{tx.label}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 0" }}>
                {TYPE_LABEL[tx.type] ?? tx.type} · {tx.actorName} · {tx.method ?? "-"}
              </p>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: isNeg ? "var(--danger)" : accent, whiteSpace: "nowrap" }}>
              {isNeg ? "" : "+"}{formatMAD(Math.abs(amount))}
            </span>
          </div>
        )
      })}
    </div>
  )
}