import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { checkMaintenanceMode } from "@/lib/utils/maintenance"
import PortalShell from "@/components/layout/PortalShell"
import MaintenanceScreen from "@/components/ui/MaintenanceScreen"

export default async function CostumesLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const session = await auth()

  if (!session?.user) {
    redirect(`/${locale}`)
  }

  const { role, portalAccess, name, modulePermissions } = session.user

  if (role === "staff" && !portalAccess.includes("costumes")) {
    redirect(`/${locale}/select-portal`)
  }

  if (role !== "superadmin") {
    const maintenance = await checkMaintenanceMode()
    if (maintenance.isActive) {
      const message = maintenance.message_ar ?? ""
      return <MaintenanceScreen locale={locale} message={message} />
    }
  }

  return (
    <PortalShell
      portal="costumes"
      locale={locale}
      role={role}
      userName={name}
      portalAccess={portalAccess}
      modulePermissions={modulePermissions}
    >
      {children}
    </PortalShell>
  )
}