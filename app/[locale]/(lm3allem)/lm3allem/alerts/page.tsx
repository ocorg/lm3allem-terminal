import { getAlerts } from "@/lib/actions/lm3allem/alerts"
import { AlertsClient } from "@/components/lm3allem/alerts/AlertsClient"

export default async function AlertsPage() {
  const alerts = await getAlerts()
  return <AlertsClient alerts={alerts} />
}