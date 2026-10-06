import "server-only"
import { cache } from "react"
import type { Session } from "next-auth"
import type { Portal } from "@prisma/client"
import { auth } from "@/lib/auth/auth"
import { ActionError } from "@/lib/actions/result"
import { checkMaintenanceMode } from "@/lib/utils/maintenance"
import { canAccessModule, canAccessPortal, isAdminRole } from "@/lib/permissions"

export type SessionUser = Session["user"]

/** One session read per request, shared by layouts, pages and actions. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth()
  return session?.user ?? null
})

interface GuardOptions {
  /** The change-password page itself must stay reachable while a password change is pending. */
  allowPasswordChange?: boolean
}

/**
 * Authorization lives INSIDE every server action: actions are reachable by direct POST, so the
 * page-level checks (layouts, withModule) are not a security boundary.
 */
export async function requireUser(opts: GuardOptions = {}): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) throw new ActionError("unauthorized")
  if (user.mustChangePassword && !opts.allowPasswordChange) throw new ActionError("password_change_required")

  // Staff are locked out during maintenance; admins and the ghost account keep working.
  if (user.role === "staff") {
    const maintenance = await checkMaintenanceMode()
    if (maintenance.isActive) throw new ActionError("maintenance")
  }
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (!isAdminRole(user.role)) throw new ActionError("forbidden")
  return user
}

export async function requireGhost(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== "ghost") throw new ActionError("forbidden")
  return user
}

export async function requirePortal(portal: Portal): Promise<SessionUser> {
  const user = await requireUser()
  if (!canAccessPortal(user, portal)) throw new ActionError("forbidden")
  return user
}

export async function requireModule(portal: Portal, module: string): Promise<SessionUser> {
  const user = await requireUser()
  if (!canAccessModule(user, portal, module)) throw new ActionError("forbidden")
  return user
}

/** Staff may hold ANY of the listed modules (e.g. a lookup read used by several screens). */
export async function requireAnyModule(portal: Portal, modules: string[]): Promise<SessionUser> {
  const user = await requireUser()
  if (!modules.some((m) => canAccessModule(user, portal, m))) throw new ActionError("forbidden")
  return user
}
