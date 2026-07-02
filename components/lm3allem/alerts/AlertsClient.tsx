"use client"

import { useRouter }          from "next/navigation"
import { useTranslations }    from "next-intl"
import { useTransition }      from "react"
import { Button }             from "@/components/ui/Button"
import { Badge }              from "@/components/ui/Badge"
import { formatMAD }          from "@/lib/utils/currency"
import { formatDate }         from "@/lib/utils/date"
import { toast }              from "@/hooks/useToast"
import { sendLowStockDigest } from "@/lib/actions/lm3allem/alerts"
import type { AlertsData }    from "@/lib/actions/lm3allem/alerts"
import type { RentalStatus }  from "@prisma/client"
import React from "react"

const PORTAL_VARIANT: Record<string, "primary" | "info" | "success"> = {
  magazin:  "primary",
  costumes: "info",
  lm3allem: "success",
}

const STATUS_VARIANT: Record<RentalStatus, "primary" | "warning" | "success" | "default" | "danger"> = {
  booked:           "primary",
  in_preparation:   "warning",
  ready_for_pickup: "warning",
  picked_up:        "success",
  returned:         "success",
  cleaning:         "default",
  available:        "success",
}

interface Props { alerts: AlertsData }

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h3>
      {count > 0 && <Badge variant="danger">{count}</Badge>}
      {count === 0 && <Badge variant="success">OK</Badge>}
    </div>
  )
}

export function AlertsClient({ alerts }: Props) {
  const t        = useTranslations("lm3allem.alerts")
  const tRental  = useTranslations("costumes.rental")
  const router   = useRouter()
  const [isPending, startTransition] = useTransition()

  const total =
    alerts.lowStockItems.length +
    alerts.openRentals.length   +
    alerts.openCaisseSessions.length +
    alerts.unpaidCredits.length

  function handleSendDigest() {
    startTransition(async () => {
      try {
        const result = await sendLowStockDigest()
        if (result.sent) {
          toast(t("digestSent", { count: result.count }), "success")
        } else {
          toast(t("digestEmpty"), "info")
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : t("digestError"), "error")
      }
    })
  }

  // Resolve status label from costumes.rental.status namespace
  function statusLabel(status: RentalStatus): string {
    return tRental(`status.${status}` as Parameters<typeof tRental>[0])
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
        {t("title")}
      </h1>

      {/* Summary Bar */}
      <div style={{
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "space-between",
        padding:         "16px 20px",
        background:      total === 0
          ? "color-mix(in srgb, var(--success) 10%, transparent)"
          : "color-mix(in srgb, var(--warning) 10%, transparent)",
        border: `1px solid ${total === 0 ? "var(--success)" : "var(--warning)"}`,
        borderRadius:    "8px",
        flexWrap:        "wrap",
        gap:             12,
      }}>
        <span style={{ fontWeight: 600, color: total === 0 ? "var(--success)" : "var(--warning)" }}>
          {total === 0 ? t("allClear") : t("activeAlerts", { count: total })}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.refresh()}
          >
            {t("refresh")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={isPending}
            onClick={handleSendDigest}
          >
            {t("digestButton")}
          </Button>
        </div>
      </div>

      {/* Low Stock */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 20 }}>
        <SectionHeader title={t("lowStock")} count={alerts.lowStockItems.length} />
        {alerts.lowStockItems.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("noAlerts")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {alerts.lowStockItems.map((item, i) => (
              <div
                key={item.id}
                style={{
                  display:           "flex",
                  justifyContent:    "space-between",
                  alignItems:        "center",
                  padding:           "10px 0",
                  borderBottom:      i < alerts.lowStockItems.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{item.name}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {item.portal} · {t("stockLevel")}: {item.stock}
                  </p>
                </div>
                <Badge variant={item.stock === 0 ? "danger" : "warning"}>{item.stock}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Open Rentals */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 20 }}>
        <SectionHeader title={t("openRentals")} count={alerts.openRentals.length} />
        {alerts.openRentals.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("noAlerts")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {alerts.openRentals.map((rental, i) => (
              <div
                key={rental.id}
                style={{
                  display:       "flex",
                  justifyContent: "space-between",
                  alignItems:    "flex-start",
                  padding:       "10px 0",
                  borderBottom:  i < alerts.openRentals.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{rental.clientName}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {t("dueDate")}: {rental.scheduledReturnDate ? formatDate(rental.scheduledReturnDate) : "-"}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <Badge variant={STATUS_VARIANT[rental.status as RentalStatus]}>{statusLabel(rental.status as RentalStatus)}</Badge>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--warning)" }}>
                    {t("balance")}: {formatMAD(rental.balance)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Open Caisse Sessions */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 20 }}>
        <SectionHeader title={t("openCaisse")} count={alerts.openCaisseSessions.length} />
        {alerts.openCaisseSessions.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("noAlerts")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {alerts.openCaisseSessions.map((session, i) => (
              <div
                key={session.id}
                style={{
                  display:       "flex",
                  justifyContent: "space-between",
                  alignItems:    "center",
                  padding:       "10px 0",
                  borderBottom:  i < alerts.openCaisseSessions.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{session.openedByName}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {t("portal")}: {session.portal} · {t("openedAt")}: {formatDate(session.openedAt)}
                  </p>
                </div>
                <Badge variant="warning">{t("sessionOpen")}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unpaid Credits */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 20 }}>
        <SectionHeader title={t("unpaidCredits")} count={alerts.unpaidCredits.length} />
        {alerts.unpaidCredits.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("noAlerts")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {alerts.unpaidCredits.map((credit, i) => (
              <div
                key={credit.id}
                style={{
                  display:       "flex",
                  justifyContent: "space-between",
                  alignItems:    "center",
                  padding:       "10px 0",
                  borderBottom:  i < alerts.unpaidCredits.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{credit.clientName}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {t("portal")}: <Badge variant="primary">magazin</Badge>
                  </p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--danger)" }}>
                  {formatMAD(credit.balance)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}