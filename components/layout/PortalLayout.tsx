import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import type { Portal } from "@prisma/client"
import { getCurrentUser } from "@/lib/auth/guard"
import { canAccessPortal } from "@/lib/permissions"
import { checkMaintenanceMode } from "@/lib/utils/maintenance"
import PortalShell from "@/components/layout/PortalShell"
import MaintenanceScreen from "@/components/ui/MaintenanceScreen"
import React from "react"

/**
 * Shared body of the three portal layouts: session, portal access, pending password change and
 * maintenance gate. (Server actions re-check everything: this is the page-level layer only.)
 */
export default async function PortalLayout({
  portal,
  locale,
  children,
}: {
  portal:   Portal
  locale:   string
  children: ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}`)
  if (user.mustChangePassword) redirect(`/${locale}/change-password`)

  if (!canAccessPortal(user, portal)) redirect(`/${locale}/select-portal`)

  // Maintenance gate: staff are blocked; admins and the ghost account always get through.
  if (user.role === "staff") {
    const maintenance = await checkMaintenanceMode()
    if (maintenance.isActive) {
      return <MaintenanceScreen locale={locale} message={maintenance.message_ar ?? ""} />
    }
  }

  return (
    <PortalShell
      portal={portal}
      locale={locale}
      role={user.role}
      userName={user.name}
      portalAccess={user.portalAccess}
      modulePermissions={user.modulePermissions}
    >
      {children}
    </PortalShell>
  )
}
