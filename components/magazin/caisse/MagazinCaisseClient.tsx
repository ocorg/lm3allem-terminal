"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Lock } from "lucide-react"
import { useCaisse }      from "@/components/caisse/CaisseProvider"
import { Button }         from "@/components/ui/Button"
import { SessionStats }   from "./SessionStats"
import { TransactionList } from "./TransactionList"
import { ManualEntryModal } from "./ManualEntryModal"
import { CloseSessionModal } from "./CloseSessionModal"
import type { SessionStats as SessionStatsType } from "@/lib/actions/magazin/caisse"

interface MagazinCaisseClientProps {
  initialStats: SessionStatsType
  role:         string
}

export function MagazinCaisseClient({ initialStats, role }: MagazinCaisseClientProps) {
  const { session }    = useCaisse()
  const router         = useRouter()
  const isAdmin        = role === "admin" || role === "superadmin"
  const [showManual, setShowManual] = useState(false)
  const [showClose,  setShowClose]  = useState(false)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
          Caisse
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setShowManual(true)}>
            Entrée manuelle
          </Button>
          {isAdmin && (
            <Button variant="danger" size="sm" icon={<Lock size={14} />} onClick={() => setShowClose(true)}>
              Clôturer
            </Button>
          )}
        </div>
      </div>

      <SessionStats stats={initialStats} />
      <TransactionList transactions={initialStats.transactions} />

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