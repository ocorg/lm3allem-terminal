"use client"

import { usePathname, useRouter } from "next/navigation"

interface Props {
  currentLocale: string
}

export default function LanguageToggle({ currentLocale }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function toggle() {
    const nextLocale = currentLocale === "fr" ? "ar" : "fr"
    const prefix = `/${currentLocale}`
    const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : ""
    router.push(`/${nextLocale}${rest}`)
  }

  return (
    <button
      onClick={toggle}
      title={
        currentLocale === "fr"
          ? "التبديل إلى العربية"
          : "Passer en français"
      }
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--text-muted)",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.02em",
        flexShrink: 0,
        transition: "color 150ms ease, border-color 150ms ease",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = "var(--primary)"
        e.currentTarget.style.borderColor = "var(--primary)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = "var(--text-muted)"
        e.currentTarget.style.borderColor = "var(--border)"
      }}
    >
      {currentLocale === "fr" ? "ع" : "FR"}
    </button>
  )
}