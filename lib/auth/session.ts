import { redirect } from "next/navigation"
import { auth } from "./auth"
import type { Portal } from "@prisma/client"

export async function getSession() {
  return auth()
}

/**
 * Ensures the current user has access to the requested portal.
 * Superadmin and admin bypass all portal checks.
 * Redirects to /select-portal if the user doesn't have access.
 */
export async function withPortal(portal: Portal) {
  const session = await auth()

  if (!session?.user) {
    redirect("/")
  }

  const { role, portalAccess } = session.user

  if (role !== "superadmin" && role !== "admin" && !portalAccess.includes(portal)) {
    redirect("/select-portal")
  }

  return session
}

/**
 * Ensures the current user has the specific module permission within a portal.
 * Superadmin and admin always pass.
 * Staff are checked against their modulePermissions JSON, with role defaults as fallback.
 */
export async function withModule(portal: Portal, module: string) {
  const session = await withPortal(portal)

  const { role, modulePermissions } = session.user

  if (role === "superadmin" || role === "admin") return session

  const allowed = (modulePermissions as Record<string, Record<string, boolean>> | null)?.[portal]?.[module]

  if (!allowed) {
    redirect(`/${portal}`)
  }

  return session
}