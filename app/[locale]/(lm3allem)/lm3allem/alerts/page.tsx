import { getAlerts, type AlertsData } from "@/lib/actions/lm3allem/alerts"
import { AlertsClient } from "@/components/lm3allem/alerts/AlertsClient"
import React from "react"

const EMPTY: AlertsData = { lowStockItems: [], openCaisseSessions: [], openRentals: [], unpaidCredits: [] }

export default async function AlertsPage() {
  let alerts: AlertsData
  try { alerts = await getAlerts() } catch { alerts = EMPTY }
  return <AlertsClient alerts={alerts} />
}
