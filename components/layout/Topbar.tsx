"use client"

import { useTransition, useState, useRef, useEffect } from "react"
import { useTranslations }     from "next-intl"
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion"
import { LogOut, LayoutGrid, Menu, Sun, Moon } from "lucide-react"
import NotificationBell        from "@/components/layout/NotificationBell"
import Link                    from "next/link"
import { signOutUser }         from "@/lib/auth/actions"
import type { Portal, Role }   from "@prisma/client"

const PORTAL_LABELS: Record<Portal, string> = {
  magazin:  "MAGAZIN",
  costumes: "COSTUMES",
  lm3allem: "LM3ALLEM",
}

interface Props {
  portal:             Portal
  userName:           string
  role:               Role
  locale:             string
  canSwitchPortal:    boolean
  isMobile:           boolean
  onMobileMenuToggle: () => void
}

export default function Topbar({
  portal,
  userName,
  role,
  locale,
  canSwitchPortal,
  isMobile,
  onMobileMenuToggle,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen]      = useState(false)
  const [theme, setTheme]            = useState<"dark" | "light">(() => {
    const current = document.documentElement.dataset.theme
    return (current === "light" || current === "dark") ? current : "dark"
  })
  const menuRef                      = useRef<HTMLDivElement>(null)
  const shouldReduce                 = useReducedMotion()

  const tCommon = useTranslations("common")
  const tTheme  = useTranslations("theme")
  const tRoles  = useTranslations("roles")

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [menuOpen])

  function handleSignOut() {
    startTransition(async () => {
      await signOutUser(locale)
    })
    setMenuOpen(false)
  }

  function toggleTheme() {
    const next: "dark" | "light" = theme === "dark" ? "light" : "dark"
    setTheme(next)
    const html = document.documentElement
    html.dataset.theme = next
    html.classList.remove(theme)
    html.classList.add(next)
    try { localStorage.setItem("lm3allem-theme", next) } catch { /* noop */ }
  }

  const initials = userName.charAt(0).toUpperCase()

  const dropdownVariants: Variants | undefined = shouldReduce
    ? undefined
    : {
        hidden:  { opacity: 0, scale: 0.95, y: -6 },
        visible: { opacity: 1, scale: 1,    y: 0, transition: { duration: 0.15, ease: "easeOut" } },
        exit:    { opacity: 0, scale: 0.95, y: -6, transition: { duration: 0.10 } },
      }

  const menuItemStyle: React.CSSProperties = {
    display:         "flex",
    alignItems:      "center",
    gap:             10,
    width:           "100%",
    padding:         "9px 14px",
    background:      "transparent",
    border:          "none",
    color:           "var(--text)",
    fontSize:        13,
    cursor:          "pointer",
    textAlign:       "start" as const,
    textDecoration:  "none",
    transition:      "background 120ms ease",
  }

  return (
    <header
      style={{
        height:          60,
        flexShrink:      0,
        background:      "var(--surface)",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "space-between",
        padding:         "0 16px",
        gap:             12,
        position:        "relative",
      }}
    >
      {/* Gradient bottom border */}
      <div
        aria-hidden="true"
        style={{
          position:        "absolute",
          bottom:          0,
          insetInlineStart: 0,
          insetInlineEnd:   0,
          height:          1,
          background:      "linear-gradient(90deg, transparent, rgba(212,148,31,0.25), transparent)",
          pointerEvents:   "none",
        }}
      />

      {/* Leading */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {isMobile && (
          <button
            onClick={onMobileMenuToggle}
            style={{
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              width:           36,
              height:          36,
              borderRadius:    8,
              border:          "1px solid var(--border)",
              background:      "transparent",
              color:           "var(--text-muted)",
              cursor:          "pointer",
              flexShrink:      0,
              transition:      "color 150ms ease, border-color 150ms ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color        = "var(--primary)"
              e.currentTarget.style.borderColor  = "var(--primary)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color        = "var(--text-muted)"
              e.currentTarget.style.borderColor  = "var(--border)"
            }}
          >
            <Menu size={16} strokeWidth={1.75} />
          </button>
        )}

        <p
          style={{
            fontSize:      11,
            fontWeight:    700,
            fontFamily:    "var(--font-display)",
            color:         "var(--text-muted)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            whiteSpace:    "nowrap",
          }}
        >
          {PORTAL_LABELS[portal]}
        </p>
      </div>

      {/* Trailing */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {portal === "lm3allem" && <NotificationBell />}

        {/* User avatar / menu trigger */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label={userName}
            aria-expanded={menuOpen}
            style={{
              width:          32,
              height:         32,
              borderRadius:   "50%",
              background:     menuOpen
                ? "var(--primary)"
                : "color-mix(in srgb, var(--primary) 20%, transparent)",
              border:         `1.5px solid ${menuOpen ? "var(--primary)" : "color-mix(in srgb, var(--primary) 40%, transparent)"}`,
              color:          menuOpen ? "#fff" : "var(--primary)",
              cursor:         "pointer",
              fontFamily:     "var(--font-display)",
              fontWeight:     800,
              fontSize:       13,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              flexShrink:     0,
              transition:     "background 150ms ease, color 150ms ease, border-color 150ms ease",
            }}
            onMouseEnter={e => {
              if (!menuOpen) {
                e.currentTarget.style.background   = "var(--primary)"
                e.currentTarget.style.color        = "#fff"
                e.currentTarget.style.borderColor  = "var(--primary)"
              }
            }}
            onMouseLeave={e => {
              if (!menuOpen) {
                e.currentTarget.style.background   = "color-mix(in srgb, var(--primary) 20%, transparent)"
                e.currentTarget.style.color        = "var(--primary)"
                e.currentTarget.style.borderColor  = "color-mix(in srgb, var(--primary) 40%, transparent)"
              }
            }}
          >
            {initials}
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{
                  position:     "absolute",
                  top:          "calc(100% + 8px)",
                  insetInlineEnd: 0,
                  width:        240,
                  background:   "var(--surface)",
                  border:       "1px solid var(--border)",
                  borderRadius: 10,
                  boxShadow:    "0 8px 32px rgba(0,0,0,0.25)",
                  zIndex:       200,
                  overflow:     "hidden",
                  transformOrigin: "top right",
                }}
              >
                {/* Identity block */}
                <div style={{
                  padding:      "14px 16px",
                  borderBottom: "1px solid var(--border)",
                  display:      "flex",
                  alignItems:   "center",
                  gap:          10,
                }}>
                  <div style={{
                    width:          36,
                    height:         36,
                    borderRadius:   "50%",
                    background:     "color-mix(in srgb, var(--primary) 15%, transparent)",
                    color:          "var(--primary)",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    fontFamily:     "var(--font-display)",
                    fontWeight:     800,
                    fontSize:       15,
                    flexShrink:     0,
                  }}>
                    {initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontSize:     13,
                      fontWeight:   600,
                      fontFamily:   "var(--font-display)",
                      color:        "var(--text)",
                      margin:       0,
                      overflow:     "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace:   "nowrap",
                    }}>
                      {userName}
                    </p>
                    <p style={{
                      fontSize:  11,
                      color:     "var(--text-muted)",
                      margin:    "2px 0 0",
                      fontFamily: "var(--font-mono)",
                    }}>
                      {tRoles(role as Parameters<typeof tRoles>[0])}
                    </p>
                  </div>
                </div>

                {/* Theme toggle */}
                <button
                  onClick={toggleTheme}
                  style={menuItemStyle}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-2)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
                >
                  {theme === "dark"
                    ? <Sun  size={15} strokeWidth={1.75} style={{ color: "var(--primary)", flexShrink: 0 }} />
                    : <Moon size={15} strokeWidth={1.75} style={{ color: "var(--primary)", flexShrink: 0 }} />
                  }
                  <span>{theme === "dark" ? tTheme("light") : tTheme("dark")}</span>
                </button>

                {/* Portal switcher */}
                {canSwitchPortal && (
                  <Link
                    href={`/${locale}/select-portal`}
                    onClick={() => setMenuOpen(false)}
                    style={menuItemStyle}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
                  >
                    <LayoutGrid size={15} strokeWidth={1.75} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <span>{tCommon("switchPortal")}</span>
                  </Link>
                )}

                {/* Divider */}
                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />

                {/* Logout */}
                <button
                  onClick={handleSignOut}
                  disabled={isPending}
                  style={{
                    ...menuItemStyle,
                    color:   "var(--danger)",
                    opacity: isPending ? 0.5 : 1,
                    cursor:  isPending ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = "color-mix(in srgb, var(--danger) 8%, transparent)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
                >
                  <LogOut size={15} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                  <span>{tCommon("logout")}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
