import type { ReactNode } from "react"
import type { Portal, Role } from "@prisma/client"
import { getTranslations } from "next-intl/server"
import { buildNavItems } from "@/lib/utils/nav"
import LayoutShell from "@/components/layout/LayoutShell"
import React from "react"

interface Props {
  portal:            Portal
  locale:            string
  role:              Role
  userName:          string
  portalAccess:      Portal[]
  modulePermissions: Record<string, Record<string, boolean>> | null
  children:          ReactNode
}

export default async function PortalShell({
  portal,
  locale,
  role,
  userName,
  portalAccess,
  modulePermissions,
  children,
}: Props) {
  const canSwitchPortal =
    role === "superadmin" || role === "admin" || portalAccess.length > 1

  const tNav =
    portal === "magazin"
      ? await getTranslations({ locale, namespace: "magazin.nav" })
      : portal === "costumes"
      ? await getTranslations({ locale, namespace: "costumes.nav" })
      : await getTranslations({ locale, namespace: "lm3allem.nav" })

  const navItems = buildNavItems({
    portal,
    role,
    modulePermissions,
    getLabel: (key: string) => tNav(key as Parameters<typeof tNav>[0]),
    locale,
  })

  return (
    <LayoutShell
      portal={portal}
      locale={locale}
      userName={userName}
      role={role}
      canSwitchPortal={canSwitchPortal}
      navItems={navItems}
    >
      {children}
    </LayoutShell>
  )
}
