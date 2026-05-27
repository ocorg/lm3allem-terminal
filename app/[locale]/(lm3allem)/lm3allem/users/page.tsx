import { getUsers } from "@/lib/actions/lm3allem/users"
import { UsersClient } from "@/components/lm3allem/users/UsersClient"

export default async function UsersPage() {
  const users = await getUsers()
  return <UsersClient initialUsers={users} />
}