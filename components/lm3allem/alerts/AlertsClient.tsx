"use client"

import { useRouter }          from "next/navigation"
import { useTranslations }    from "next-intl"
import { useTransition }      from "react"
import { Button }             from "@/components/ui/Button"
import { Badge }              from "@/components/ui/Badge"
import { formatMAD }          from "@/lib/utils/currency"
import { formatDay }         from "@/lib/utils/date"
import { toast }              from "@/hooks/useToast"
import { sendLowStockDigest } from "@/lib/actions/lm3allem/alerts"
import type { AlertsData }    from "@/lib/actions/lm3allem/alerts"
import type { RentalStatus }  from "@prisma/client"
import React from "react"
import { DateText } from "@/components/ui/DateText"
import { portalLabel } from "@/lib/utils/labels"

const STATUS_VARIANT: Record<RentalStatus, "primary" | "warning" | "success" | "default" | "danger"> = {
  booked:           "primary",
  in_preparation:   "warning",
  ready_for_pickup: "warning",
  picked_up:        "success",
  returned:         "success",
  cleaning:         "default",
  available:        "success",
  cancelled:        "danger",
}

interface Props { alerts: AlertsData }

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{title}</h2>
      {count > 0 && <Badge variant="danger">{count}</Badge>}
      {count === 0 && <Badge variant="success">OK</Badge>}
    </div>
  )
}

export function AlertsClient({ alerts }: Props) {
  const t        = useTranslations("lm3allem.alerts")
  const tStatus  = useTranslations("costumes.status")
  const router   = useRouter()
  const [isPending, startTransition] = useTransition()

  const total =
    alerts.lowStockItems.length +
    alerts.overdueRentals.length +
    alerts.openRentals.length   +
    alerts.openCaisseSessions.length +
    alerts.unpaidCredits.length

  function handleSendDigest() {
    startTransition(async () => {
      const res = await sendLowStockDigest()
      if (!res.ok) { toast(res.message || t("digestError"), "error"); return }
      if (res.data.sent) {
        toast(t("digestSent", { count: res.data.count }), "success")
      } else {
        toast(t("digestEmpty"), "info")
      }
    })
  }

  function statusLabel(status: RentalStatus): string {
    return tStatus(status)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)",margin: 0 }}>
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
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {portalLabel(item.portal)} · {t("stockLevel")}: {item.stock}
                  </p>
                </div>
                <Badge variant={item.stock === 0 ? "danger" : "warning"}>{item.stock}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overdue rentals: kit still out although the return day is over */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 20 }}>
        <SectionHeader title={t("overdueRentals")} count={alerts.overdueRentals.length} />
        {alerts.overdueRentals.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("noAlerts")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {alerts.overdueRentals.map((rental, i) => (
              <div
                key={rental.id}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                  padding: "10px 0",
                  borderBottom: i < alerts.overdueRentals.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{rental.clientName} · {rental.reference}</p>
                  <p dir="ltr" style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0", textAlign: "start" }}>{rental.clientPhone}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {t("dueDate")}: {formatDay(rental.scheduledReturnDate)}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <Badge variant="danger">{t("daysOverdue", { count: rental.daysOverdue })}</Badge>
                  {parseFloat(rental.balance) > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--warning)" }}>{t("balance")}: {formatMAD(rental.balance)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rentals with an unpaid balance */}
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
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {t("dueDate")}: {rental.scheduledReturnDate ? formatDay(rental.scheduledReturnDate) : "-"}
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
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {t("portal")}: {portalLabel(session.portal)} · {t("openedAt")}: <DateText value={session.openedAt} />
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
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
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