"use client"

import { useTransition } from "react"
import { LogOut, LayoutGrid, Menu } from "lucide-react"
import NotificationBell from "@/components/layout/NotificationBell"
import Link from "next/link"
import ThemeToggle from "@/components/ui/ThemeToggle"
import LanguageToggle from "@/components/ui/LanguageToggle"
import { signOutUser } from "@/lib/auth/actions"
import type { Portal } from "@prisma/client"

const PORTAL_LABELS: Record<Portal, string> = {
  magazin:  "Magazin",
  costumes: "Costumes",
  lm3allem: "Lm3allem",
}

interface Props {
  portal:             Portal
  userName:           string
  locale:             string
  canSwitchPortal:    boolean
  isMobile:           boolean
  onMobileMenuToggle: () => void
}

export default function Topbar({
  portal,
  userName,
  locale,
  canSwitchPortal,
  isMobile,
  onMobileMenuToggle,
}: Props) {
  const [isPending, startTransition] = useTransition()

  function handleSignOut() {
    startTransition(async () => {
      await signOutUser(locale)
    })
  }

  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        gap: 12,
      }}
    >
      {/* Leading */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Hamburger — mobile only */}
        {isMobile && (
          <button
            onClick={onMobileMenuToggle}
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
            <Menu size={16} strokeWidth={1.75} />
          </button>
        )}

        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {PORTAL_LABELS[portal]}
        </p>
      </div>

      {/* Trailing — controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Username — hidden on mobile */}
        {!isMobile && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text)",
              whiteSpace: "nowrap",
            }}
          >
            {userName}
          </span>
        )}

        {/* Divider — hidden on mobile */}
        {!isMobile && (
          <div
            style={{
              width: 1,
              height: 18,
              background: "var(--border)",
              flexShrink: 0,
            }}
          />
        )}

        {/* Portal switcher */}
        {canSwitchPortal && (
          <Link
            href={`/${locale}/select-portal`}
            title="Changer de portail"
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
              transition: "color 150ms ease, border-color 150ms ease",
              flexShrink: 0,
              textDecoration: "none",
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
            <LayoutGrid size={15} strokeWidth={1.75} />
          </Link>
        )}

        {portal === "lm3allem" && <NotificationBell />}
        <LanguageToggle currentLocale={locale} />
        <ThemeToggle />

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={isPending}
          title="Déconnexion"
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
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.5 : 1,
            transition: "color 150ms ease, border-color 150ms ease",
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            if (!isPending) {
              e.currentTarget.style.color = "var(--danger)"
              e.currentTarget.style.borderColor = "var(--danger)"
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = "var(--text-muted)"
            e.currentTarget.style.borderColor = "var(--border)"
          }}
        >
          <LogOut size={15} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  )
}