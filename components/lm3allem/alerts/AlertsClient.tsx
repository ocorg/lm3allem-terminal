"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { formatMAD } from "@/lib/utils/currency"
import { formatDate } from "@/lib/utils/date"
import { toast } from "@/hooks/useToast"
import { sendLowStockDigest } from "@/lib/actions/lm3allem/alerts"
import type { AlertsData } from "@/lib/actions/lm3allem/alerts"

interface Props { alerts: AlertsData }

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
      <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>{title}</h3>
      {count > 0 && <Badge variant="danger">{count}</Badge>}
      {count === 0 && <Badge variant="success">OK</Badge>}
    </div>
  )
}

export function AlertsClient({ alerts }: Props) {
  const t = useTranslations("lm3allem.alerts")
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const total =
    alerts.lowStockItems.length +
    alerts.openRentals.length +
    alerts.openCaisseSessions.length +
    alerts.unpaidCredits.length

  function handleSendDigest() {
    startTransition(async () => {
      try {
        const result = await sendLowStockDigest()
        if (result.sent) {
          toast(`Digest envoyé — ${result.count} article(s)`, "success")
        } else {
          toast("Aucun article en stock bas", "info")
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : "Erreur envoi digest", "error")
      }
    })
  }

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Summary Bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem 1.25rem",
        background: total === 0
          ? "color-mix(in srgb, var(--success) 10%, transparent)"
          : "color-mix(in srgb, var(--warning) 10%, transparent)",
        border: `1px solid ${total === 0 ? "var(--success)" : "var(--warning)"}`,
        borderRadius: "8px",
      }}>
        <span style={{ fontWeight: 600, color: total === 0 ? "var(--success)" : "var(--warning)" }}>
          {total === 0 ? t("allClear") : `${total} alertes actives`}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            variant="ghost"
            size="sm"
            loading={isPending}
            onClick={handleSendDigest}
          >
            Envoyer digest stock
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
            Actualiser
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

        {/* Low Stock */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "1.25rem" }}>
          <SectionHeader title={t("lowStock")} count={alerts.lowStockItems.length} />
          {alerts.lowStockItems.length === 0
            ? <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</p>
            : alerts.lowStockItems.map((item, i) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0",
                  borderBottom: i < alerts.lowStockItems.length - 1 ? "1px solid var(--border)" : "none",
                  borderInlineStart: `3px solid ${item.stock === 0 ? "var(--danger)" : "var(--warning)"}`,
                  paddingInlineStart: "0.75rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.875rem" }}>{item.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.portal}</div>
                </div>
                <Badge variant={item.stock === 0 ? "danger" : "warning"}>
                  {t("stockLevel")}: {item.stock}
                </Badge>
              </div>
            ))
          }
        </div>

        {/* Open Caisse */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "1.25rem" }}>
          <SectionHeader title={t("openCaisse")} count={alerts.openCaisseSessions.length} />
          {alerts.openCaisseSessions.length === 0
            ? <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</p>
            : alerts.openCaisseSessions.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0",
                  borderBottom: i < alerts.openCaisseSessions.length - 1 ? "1px solid var(--border)" : "none",
                  borderInlineStart: "3px solid var(--warning)",
                  paddingInlineStart: "0.75rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.875rem" }}>{s.openedByName}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{s.portal} · {formatDate(s.openedAt)}</div>
                </div>
                <Badge variant="warning">Ouverte</Badge>
              </div>
            ))
          }
        </div>

        {/* Open Rentals */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "1.25rem" }}>
          <SectionHeader title={t("openRentals")} count={alerts.openRentals.length} />
          {alerts.openRentals.length === 0
            ? <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</p>
            : alerts.openRentals.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0",
                  borderBottom: i < alerts.openRentals.length - 1 ? "1px solid var(--border)" : "none",
                  borderInlineStart: "3px solid var(--danger)",
                  paddingInlineStart: "0.75rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>{r.reference}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {r.clientName} · {t("dueDate")}: {formatDate(r.scheduledReturnDate)}
                  </div>
                </div>
                <div style={{ textAlign: "end" }}>
                  <div style={{ fontWeight: 600, color: "var(--danger)", fontSize: "0.875rem" }}>{formatMAD(r.balance)}</div>
                  <Badge variant="default">{r.status}</Badge>
                </div>
              </div>
            ))
          }
        </div>

        {/* Unpaid Credits */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "1.25rem" }}>
          <SectionHeader title={t("unpaidCredits")} count={alerts.unpaidCredits.length} />
          {alerts.unpaidCredits.length === 0
            ? <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</p>
            : alerts.unpaidCredits.map((c, i) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0",
                  borderBottom: i < alerts.unpaidCredits.length - 1 ? "1px solid var(--border)" : "none",
                  borderInlineStart: "3px solid var(--danger)",
                  paddingInlineStart: "0.75rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>{c.clientName}</div>
                  {c.clientPhone && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{c.clientPhone}</div>
                  )}
                </div>
                <div style={{ fontWeight: 600, color: "var(--danger)", fontSize: "0.875rem" }}>
                  {formatMAD(c.balance)}
                </div>
              </div>
            ))
          }
        </div>

      </div>
    </div>
  )
}