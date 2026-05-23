import type { ReactNode } from "react"
import type { Portal, Role } from "@prisma/client"
import { getTranslations } from "next-intl/server"
import Sidebar from "@/components/layout/Sidebar"
import Topbar from "@/components/layout/Topbar"
import { buildNavItems } from "@/lib/utils/nav"
import type { Portal as PortalEnum } from "@prisma/client"

interface Props {
  portal: Portal
  locale: string
  role: Role
  userName: string
  portalAccess: PortalEnum[]
  modulePermissions: Record<string, Record<string, boolean>> | null
  children: ReactNode
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
  // Translate nav labels server-side
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
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg)",
      }}
    >
      <Sidebar portal={portal} navItems={navItems} locale={locale} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar portal={portal} userName={userName} locale={locale} canSwitchPortal={canSwitchPortal} />

        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 24,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}