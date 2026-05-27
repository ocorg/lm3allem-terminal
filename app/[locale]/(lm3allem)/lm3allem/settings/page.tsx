import { getSystemSettings } from "@/lib/actions/lm3allem/settings"
import { SettingsClient } from "@/components/lm3allem/settings/SettingsClient"

export default async function SettingsPage() {
  const settings = await getSystemSettings()
  return <SettingsClient settings={settings} />
}