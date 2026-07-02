import { getUsers } from "@/lib/actions/lm3allem/users"
import { UsersClient } from "@/components/lm3allem/users/UsersClient"
import React from "react"

export default async function UsersPage() {
  let users: Awaited<ReturnType<typeof getUsers>>
  try { users = await getUsers() } catch { users = [] }
  return <UsersClient initialUsers={users} />
}
