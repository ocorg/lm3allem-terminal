import { LogoutButton }      from "@/components/auth/LogoutButton"
import { Wrench }            from "lucide-react"
import { getTranslations }   from "next-intl/server"
import React from "react"
import { BrandLogo } from "@/components/ui/BrandLogo"

interface Props {
  locale:  string
  message: string
}

export default async function MaintenanceScreen({ locale, message }: Props) {
  const t = await getTranslations({ locale, namespace: "maintenance" })
  const tCommon = await getTranslations({ locale, namespace: "common" })

  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        minHeight:      "100vh",
        background:     "var(--bg)",
        padding:        24,
        gap:            24,
        textAlign:      "center",
      }}
    >
      {/* Logo */}
      <BrandLogo size={104} />

      {/* Icon */}
      <div style={{ color: "var(--text-muted)", opacity: 0.4 }}>
        <Wrench size={40} strokeWidth={1.25} />
      </div>

      {/* Title */}
      <div style={{ maxWidth: 340 }}>
        <h1
          style={{
            fontSize:      18,
            fontWeight:    600,
            fontFamily:    "var(--font-display)",
            color:         "var(--text)",
            marginBottom:  10,
          }}
        >
          {t("title")}
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
          {message}
        </p>
      </div>

      {/* Staff are blocked during maintenance: let them sign out (admins are never shown this screen) */}
      <LogoutButton locale={locale} className="maintenance-login-btn">{tCommon("logout")}</LogoutButton>
    </div>
  )
}
