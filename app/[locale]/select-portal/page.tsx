import { redirect }              from "next/navigation"
import { LogoutButton }          from "@/components/auth/LogoutButton"
import { getCurrentUser }        from "@/lib/auth/guard"
import { isAdminRole }           from "@/lib/permissions"
import { getTranslations }       from "next-intl/server"
import type { Portal }           from "@prisma/client"
import { PortalCardsClient }     from "./PortalCardsClient"
import { BrandLogo }             from "@/components/ui/BrandLogo"
import { firstAccessiblePath }   from "@/lib/utils/nav"
import React from "react"

const ALL_PORTALS: Portal[] = ["magazin", "costumes", "lm3allem"]

export default async function SelectPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }  = await params
  const user        = await getCurrentUser()

  if (!user) redirect(`/${locale}`)
  if (user.mustChangePassword) redirect(`/${locale}/change-password`)

  const { role, portalAccess } = user
  const t                      = await getTranslations({ locale, namespace: "portal" })
  const tCommon                = await getTranslations({ locale, namespace: "common" })

  const isPrivileged  = isAdminRole(role)
  const portalsToShow = isPrivileged ? ALL_PORTALS : portalAccess.filter(p => p !== "lm3allem")

  if (!isPrivileged && portalsToShow.length === 1) {
    redirect(`/${locale}/${portalsToShow[0]}/${firstAccessiblePath(user, portalsToShow[0] as Portal)}`)
  }

  if (!isPrivileged && portalsToShow.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", gap: 16, padding: 24, textAlign: "center" }}>
        <BrandLogo size={88} />
        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0, fontFamily: "var(--font-display)" }}>
          {t("noAccess")}
        </p>
        <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 320, lineHeight: 1.6, margin: 0 }}>
          {t("noAccessMessage")}
        </p>
        <LogoutButton locale={locale} style={{ marginTop: 8, padding: "8px 20px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>{tCommon("logout")}</LogoutButton>
      </div>
    )
  }

  const labels = {
    magazin:  t("magazin"),
    costumes: t("costumes"),
    lm3allem: t("lm3allem"),
  } as Record<Portal, string>

  const homes = Object.fromEntries(ALL_PORTALS.map((p) => [p, firstAccessiblePath(user, p)])) as Record<Portal, string>

  return (
    <main
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
          background: "radial-gradient(ellipse 600px 400px at 50% 55%, rgba(245,154,14,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div style={{ textAlign: "center", position: "relative" }}>
        <BrandLogo size={104} style={{ margin: "0 auto 14px" }} />
        <h1 style={{
          fontSize:      22,
          fontWeight:    700,
          fontFamily:    "var(--font-display)",
          color:         "var(--text)",
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
        descriptions={{ magazin: t("magazinDesc"), costumes: t("costumesDesc"), lm3allem: t("lm3allemDesc") }}
        homes={homes}
      />

      {/* User + logout */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, position: "relative" }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", margin: 0 }}>
          {user.name}
        </p>
        <LogoutButton locale={locale} style={{ padding: "8px 20px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>{tCommon("logout")}</LogoutButton>
      </div>
    </main>
  )
}
