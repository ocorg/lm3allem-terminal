import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import type { Portal } from "@prisma/client"
import { Store, Shirt, LayoutDashboard } from "lucide-react"
import type { LucideIcon } from "lucide-react"

const ALL_PORTALS: Portal[] = ["magazin", "costumes", "lm3allem"]

const PORTAL_ICONS: Record<Portal, LucideIcon> = {
  magazin: Store,
  costumes: Shirt,
  lm3allem: LayoutDashboard,
}

export default async function SelectPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const session = await auth()

  if (!session?.user) {
    redirect(`/${locale}`)
  }

  const { role, portalAccess } = session.user
  const t = await getTranslations({ locale, namespace: "portal" })

  const isPrivileged = role === "superadmin" || role === "admin"
  const portalsToShow: Portal[] = isPrivileged ? ALL_PORTALS : portalAccess

  // Staff with exactly 1 portal — redirect directly
  if (!isPrivileged && portalsToShow.length === 1) {
    redirect(`/${locale}/${portalsToShow[0]}`)
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg)",
        gap: 48,
        padding: 24,
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Lm3allem Terminal
        </p>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "var(--text)",
            letterSpacing: "-0.02em",
          }}
        >
          {t("select")}
        </h1>
      </div>

      {/* Portal cards */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {portalsToShow.map(portal => {
          const Icon = PORTAL_ICONS[portal]
          return (
            <Link
              key={portal}
              href={`/${locale}/${portal}`}
              className="portal-card"
            >
              <span className="portal-card__icon">
                <Icon size={32} strokeWidth={1.5} />
              </span>
              <span className="portal-card__name">{t(portal)}</span>
            </Link>
          )
        })}
      </div>

      {/* Signed-in user context */}
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {session.user.name}
      </p>
    </div>
  )
}