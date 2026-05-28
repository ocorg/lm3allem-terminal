"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ShoppingCart, Package, Wallet, CreditCard, ClipboardList,
  BookOpen, Users, LayoutDashboard, TrendingUp, Receipt,
  ScrollText, SlidersHorizontal, Settings, Bell,
  ChevronLeft, ChevronRight, type LucideIcon,
} from "lucide-react"
import type { NavItem } from "@/lib/utils/nav"
import type { Portal } from "@prisma/client"
import { useBreakpoint } from "@/hooks/useBreakpoint"

const ICON_MAP: Record<string, LucideIcon> = {
  pos:       ShoppingCart,
  inventory: Package,
  caisse:    Wallet,
  credits:   CreditCard,
  requests:  ClipboardList,
  catalogue: BookOpen,
  clients:   Users,
  dashboard: LayoutDashboard,
  finances:  TrendingUp,
  expenses:  Receipt,
  users:     Users,
  logs:      ScrollText,
  options:   SlidersHorizontal,
  settings:  Settings,
  alerts:    Bell,
}

const PORTAL_INITIALS: Record<Portal, string> = {
  magazin:  "M",
  costumes: "C",
  lm3allem: "L",
}

const PORTAL_LABELS: Record<Portal, string> = {
  magazin:  "Magazin",
  costumes: "Costumes",
  lm3allem: "Lm3allem",
}

interface Props {
  portal:        Portal
  navItems:      NavItem[]
  locale:        string
  isMobile:      boolean
  mobileOpen:    boolean
  onMobileClose: () => void
}

const STORAGE_KEY = "lm3allem-sidebar-collapsed"

export default function Sidebar({
  portal,
  navItems,
  locale,
  isMobile,
  mobileOpen,
  onMobileClose,
}: Props) {
  const pathname         = usePathname()
  const isRTL            = locale === "ar"
  const { isTablet }     = useBreakpoint()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted,   setMounted]   = useState(false)

  // Initial state on mount
  useEffect(() => {
    if (isTablet) {
      setCollapsed(true)
    } else {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "true") setCollapsed(true)
    }
    setMounted(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-collapse when resizing into tablet range
  useEffect(() => {
    if (isTablet) setCollapsed(true)
  }, [isTablet])

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    if (!isTablet) localStorage.setItem(STORAGE_KEY, String(next))
  }

  const visible = navItems.filter(i => i.visible)

  const ExpandIcon   = isRTL ? ChevronLeft  : ChevronRight
  const CollapseIcon = isRTL ? ChevronRight : ChevronLeft
  const ToggleIcon   = collapsed ? ExpandIcon : CollapseIcon

  const isCollapsed = !isMobile && mounted && collapsed

  return (
    <aside
      style={{
        width: isMobile ? 240 : (isCollapsed ? 64 : 240),
        flexShrink: 0,
        height: "100vh",
        background: "var(--surface)",
        borderInlineEnd: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: isMobile
          ? "transform 250ms cubic-bezier(0.4, 0, 0.2, 1)"
          : "width 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        // Mobile overlay
        ...(isMobile ? {
          position: "fixed" as const,
          top: 0,
          [isRTL ? "right" : "left"]: 0,
          zIndex: 1000,
          width: 240,
          transform: mobileOpen
            ? "translateX(0)"
            : (isRTL ? "translateX(100%)" : "translateX(-100%)"),
          boxShadow: mobileOpen ? "4px 0 32px rgba(0,0,0,0.35)" : "none",
        } : {}),
      }}
    >
      {/* Portal header */}
      <div
        style={{
          padding: isCollapsed ? "18px 0" : "18px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: isCollapsed ? "center" : "flex-start",
          minHeight: 64,
          transition: "padding 220ms ease",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "rgba(212,148,31,0.12)",
            color: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "-0.01em",
          }}
        >
          {PORTAL_INITIALS[portal]}
        </div>

        <div
          style={{
            opacity: isCollapsed ? 0 : 1,
            maxWidth: isCollapsed ? 0 : 200,
            overflow: "hidden",
            whiteSpace: "nowrap",
            transition: "opacity 180ms ease, max-width 220ms ease",
          }}
        >
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--primary)",
              letterSpacing: "-0.015em",
            }}
          >
            {PORTAL_LABELS[portal]}
          </p>
          <p
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginTop: 1,
            }}
          >
            Terminal
          </p>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 0" }}>
        {visible.map(item => {
          const Icon     = ICON_MAP[item.key] ?? Package
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

          return (
            <NavLink
              key={item.key}
              href={item.href}
              label={item.label}
              icon={Icon}
              isActive={isActive}
              collapsed={isCollapsed}
              onClick={isMobile ? onMobileClose : undefined}
            />
          )
        })}
      </nav>

      {/* Collapse toggle — desktop only */}
      {!isMobile && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "10px 12px",
            display: "flex",
            justifyContent: collapsed ? "center" : (isRTL ? "flex-start" : "flex-end"),
          }}
        >
          <button
            onClick={toggle}
            title={collapsed ? "Expand" : "Collapse"}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
            <ToggleIcon size={14} strokeWidth={2} />
          </button>
        </div>
      )}
    </aside>
  )
}

interface NavLinkProps {
  href:      string
  label:     string
  icon:      LucideIcon
  isActive:  boolean
  collapsed: boolean
  onClick?:  () => void
}

function NavLink({ href, label, icon: Icon, isActive, collapsed, onClick }: NavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: collapsed ? "10px 0" : "9px 16px",
        justifyContent: collapsed ? "center" : "flex-start",
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
        color: isActive ? "var(--primary)" : "var(--text-muted)",
        textDecoration: "none",
        borderInlineStart: isActive ? "3px solid var(--primary)" : "3px solid transparent",
        background: isActive ? "rgba(212,148,31,0.06)" : "transparent",
        transition: "all 150ms ease",
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.color = "var(--text)"
          e.currentTarget.style.background = "var(--surface-2)"
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.color = "var(--text-muted)"
          e.currentTarget.style.background = "transparent"
        }
      }}
    >
      <Icon size={15} strokeWidth={isActive ? 2.25 : 1.75} style={{ flexShrink: 0 }} />
      <span
        style={{
          opacity: collapsed ? 0 : 1,
          maxWidth: collapsed ? 0 : 200,
          overflow: "hidden",
          transition: "opacity 180ms ease, max-width 220ms ease",
        }}
      >
        {label}
      </span>
    </Link>
  )
}