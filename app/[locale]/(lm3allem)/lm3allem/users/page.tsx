import { getUsers } from "@/lib/actions/lm3allem/users"
import { getSystemSettings } from "@/lib/actions/lm3allem/settings"
import { UsersClient } from "@/components/lm3allem/users/UsersClient"
import React from "react"

export default async function UsersPage() {
  const [users, settings] = await Promise.all([getUsers(), getSystemSettings()])
  return <UsersClient initialUsers={users} defaultPermissions={settings.defaultStaffPermissions} />
}
