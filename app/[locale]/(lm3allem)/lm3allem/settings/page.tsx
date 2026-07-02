import { auth } from "@/lib/auth/auth"
import { getSystemSettings } from "@/lib/actions/lm3allem/settings"
import { SettingsClient } from "@/components/lm3allem/settings/SettingsClient"
import React from "react"

export default async function SettingsPage() {
  const [settings, session] = await Promise.all([getSystemSettings(), auth()])
  return <SettingsClient settings={settings} role={session?.user.role ?? "admin"} />
}