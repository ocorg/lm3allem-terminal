import "server-only"
import { redirect } from "next/navigation"
import type { Portal } from "@prisma/client"
import { getCurrentUser, type SessionUser } from "@/lib/auth/guard"
import { routing } from "@/lib/i18n/routing"
import { canAccessModule, canAccessPortal, isAdminRole } from "@/lib/permissions"
import { checkMaintenanceMode } from "@/lib/utils/maintenance"
import { firstAccessiblePath } from "@/lib/utils/nav"

const L = routing.defaultLocale

export async function getSession() {
  const user = await getCurrentUser()
  return user ? { user } : null
}

async function requireSessionUser(locale: string): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}`)
  if (user.mustChangePassword) redirect(`/${locale}/change-password`)
  if (user.role === "staff") {
    const maintenance = await checkMaintenanceMode()
    if (maintenance.isActive) redirect(`/${locale}/select-portal`)
  }
  return user
}

/** Page-level guard: the user must be allowed into the portal. (Actions re-check on their own.) */
export async function withPortal(portal: Portal, locale: string = L) {
  const user = await requireSessionUser(locale)
  if (!canAccessPortal(user, portal)) redirect(`/${locale}/select-portal`)
  return { user }
}

/** Page-level guard: the user must be allowed to open the module. */
export async function withModule(portal: Portal, module: string, locale: string = L) {
  const { user } = await withPortal(portal, locale)
  if (!canAccessModule(user, portal, module)) {
    // Send them to a screen they CAN open. Never back to the portal root: it points to the default
    // screen, and if that is the one refused here the browser would loop forever.
    const home = firstAccessiblePath(user, portal)
    const homeModule = home.replace(/-/g, "_")
    if (home === module || homeModule === module) redirect(`/${locale}/select-portal`)
    redirect(`/${locale}/${portal}/${home}`)
  }
  return { user }
}

/** Page-level guard for admin-only screens (the whole lm3allem portal). */
export async function withAdmin(locale: string = L) {
  const user = await requireSessionUser(locale)
  if (!isAdminRole(user.role)) redirect(`/${locale}/select-portal`)
  return { user }
}
