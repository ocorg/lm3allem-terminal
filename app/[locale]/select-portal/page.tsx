import { redirect } from "next/navigation"
import { auth, signOut } from "@/lib/auth/auth"

async function handleSignOut(locale: string) {
  "use server"
  await signOut({ redirectTo: `/${locale}` })
}
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

  // Staff with no portal access — show a clear error instead of blank screen
  if (!isPrivileged && portalsToShow.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--bg)",
          gap: 16,
          padding: 24,
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 13, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Lm3allem Terminal
        </p>
        <p style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", margin: 0 }}>
          Aucun accès configuré
        </p>
        <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 320, lineHeight: 1.6, margin: 0 }}>
          Votre compte n&apos;a accès à aucun portail. Contactez un administrateur pour configurer vos permissions.
        </p>
        <form action={handleSignOut.bind(null, locale)}>
          <button type="submit" style={{ marginTop: 8, padding: "8px 20px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>
            Se déconnecter
          </button>
        </form>
      </div>
    )
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