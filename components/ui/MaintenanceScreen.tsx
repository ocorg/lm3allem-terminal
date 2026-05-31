import Link                  from "next/link"
import { Wrench }            from "lucide-react"
import { getTranslations }   from "next-intl/server"

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
      <div>
        <p
          style={{
            fontSize:      26,
            fontWeight:    800,
            fontFamily:    "var(--font-display)",
            color:         "var(--primary)",
            letterSpacing: "-0.025em",
            lineHeight:    1,
          }}
        >
          Lm3allem
        </p>
        <p
          style={{
            fontSize:      11,
            fontFamily:    "var(--font-mono)",
            color:         "var(--text-muted)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginTop:     5,
          }}
        >
          Terminal
        </p>
      </div>

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
            letterSpacing: "-0.01em",
          }}
        >
          {t("title")}
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
          {message}
        </p>
      </div>

      {/* Login button — always accessible for superadmin */}
      <Link href={`/${locale}`} className="maintenance-login-btn">
        {tCommon("login")}
      </Link>
    </div>
  )
}
