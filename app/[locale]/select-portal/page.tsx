import { redirect }              from "next/navigation"
import { auth, signOut }         from "@/lib/auth/auth"
import { getTranslations }       from "next-intl/server"
import type { Portal }           from "@prisma/client"
import { PortalCardsClient }     from "./PortalCardsClient"

async function handleSignOut(locale: string) {
  "use server"
  await signOut({ redirectTo: `/${locale}` })
}

const ALL_PORTALS: Portal[] = ["magazin", "costumes", "lm3allem"]

export default async function SelectPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }  = await params
  const session     = await auth()

  if (!session?.user) redirect(`/${locale}`)

  const { role, portalAccess } = session.user
  const t                      = await getTranslations({ locale, namespace: "portal" })
  const tCommon                = await getTranslations({ locale, namespace: "common" })

  const isPrivileged  = role === "superadmin" || role === "admin"
  const portalsToShow = isPrivileged ? ALL_PORTALS : portalAccess

  if (!isPrivileged && portalsToShow.length === 1) redirect(`/${locale}/${portalsToShow[0]}`)

  if (!isPrivileged && portalsToShow.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", gap: 16, padding: 24, textAlign: "center" }}>
        <p style={{ fontSize: 11, fontFamily: "var(--font-display)", color: "var(--primary)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          Lm3allem Terminal
        </p>
        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0, fontFamily: "var(--font-display)" }}>
          {t("noAccess")}
        </p>
        <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 320, lineHeight: 1.6, margin: 0 }}>
          {t("noAccessMessage")}
        </p>
        <form action={handleSignOut.bind(null, locale)}>
          <button type="submit" style={{ marginTop: 8, padding: "8px 20px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>
            {tCommon("logout")}
          </button>
        </form>
      </div>
    )
  }

  const labels = {
    magazin:  t("magazin"),
    costumes: t("costumes"),
    lm3allem: t("lm3allem"),
  } as Record<Portal, string>

  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        minHeight:      "100vh",
        background:     "var(--bg)",
        gap:            48,
        padding:        24,
        position:       "relative",
        overflow:       "hidden",
      }}
    >
      {/* Radial golden glow behind cards */}
      <div
        aria-hidden="true"
        style={{
          position:   "absolute",
          inset:      0,
          background: "radial-gradient(ellipse 600px 400px at 50% 55%, rgba(212,148,31,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div style={{ textAlign: "center", position: "relative" }}>
        <p style={{
          fontSize:      11,
          fontFamily:    "var(--font-display)",
          color:         "var(--primary)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginBottom:  10,
          fontWeight:    800,
        }}>
          Lm3allem Terminal
        </p>
        <h1 style={{
          fontSize:      22,
          fontWeight:    700,
          fontFamily:    "var(--font-display)",
          color:         "var(--text)",
          letterSpacing: "-0.02em",
          margin:        0,
        }}>
          {t("select")}
        </h1>
      </div>

      {/* Animated portal cards */}
      <PortalCardsClient
        portals={portalsToShow as Portal[]}
        locale={locale}
        labels={labels}
      />

      {/* User */}
      <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", position: "relative" }}>
        {session.user.name}
      </p>
    </div>
  )
}
