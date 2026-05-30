import { getAlerts, type AlertsData } from "@/lib/actions/lm3allem/alerts"
import { AlertsClient } from "@/components/lm3allem/alerts/AlertsClient"

const EMPTY: AlertsData = { lowStock: [], openCaisse: [], openRentals: [], unpaidCredits: [] }

export default async function AlertsPage() {
  let alerts: AlertsData
  try { alerts = await getAlerts() } catch { alerts = EMPTY }
  return <AlertsClient alerts={alerts} />
}
