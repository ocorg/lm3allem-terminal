"use client"

import { usePathname } from "next/navigation"
import Link            from "next/link"
import { useEffect, useState } from "react"
import { motion, useReducedMotion, type Variants } from "framer-motion"
import {
  ShoppingCart, Package, Wallet, CreditCard, ClipboardList,
  BookOpen, Users, LayoutDashboard, TrendingUp, Receipt,
  ScrollText, SlidersHorizontal, Settings, Bell,
  CalendarCheck, Shirt,
  ChevronLeft, ChevronRight, type LucideIcon,
} from "lucide-react"
import type { NavItem } from "@/lib/utils/nav"
import type { Portal } from "@prisma/client"
import { useBreakpoint } from "@/hooks/useBreakpoint"
import React from "react"

const ICON_MAP: Record<string, LucideIcon> = {
  pos:              ShoppingCart,
  inventory:        Package,
  rentals:          CalendarCheck,
  rental_inventory: Shirt,
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
  userName:      string
  isMobile:      boolean
  mobileOpen:    boolean
  onMobileClose: () => void
}

const STORAGE_KEY = "lm3allem-sidebar-collapsed"

export default function Sidebar({
  portal,
  navItems,
  locale,
  userName,
  isMobile,
  mobileOpen,
  onMobileClose,
}: Props) {
  const pathname         = usePathname()
  const isRTL            = locale === "ar"
  const { isTablet }     = useBreakpoint()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted,   setMounted]   = useState(false)
  const shouldReduce               = useReducedMotion()

  useEffect(() => {
    if (isTablet) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(true)
    } else {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "true") setCollapsed(true)
    }
    setMounted(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isTablet) setCollapsed(true)
  }, [isTablet])

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    if (!isTablet) localStorage.setItem(STORAGE_KEY, String(next))
  }

  const visible    = navItems.filter(i => i.visible)
  const ExpandIcon   = isRTL ? ChevronLeft  : ChevronRight
  const CollapseIcon = isRTL ? ChevronRight : ChevronLeft
  const ToggleIcon   = collapsed ? ExpandIcon : CollapseIcon
  const isCollapsed  = !isMobile && mounted && collapsed

  // User initials
  const userInitials = userName.charAt(0).toUpperCase()

  const navContainerVariants: Variants | undefined = shouldReduce ? undefined : {
    hidden:   {},
    visible:  { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
  }

  const navItemVariants: Variants | undefined = shouldReduce ? undefined : {
    hidden:   { opacity: 0, x: isRTL ? 4 : -4 },
    visible:  { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" } },
  }

  return (
    <aside
      style={{
        width:           isMobile ? 240 : (isCollapsed ? 64 : 240),
        flexShrink:      0,
        height:          "100vh",
        background:      "var(--surface)",
        borderInlineEnd: "1px solid var(--border)",
        display:         "flex",
        flexDirection:   "column",
        overflow:        "hidden",
        transition:      isMobile
          ? "transform 250ms cubic-bezier(0.4, 0, 0.2, 1)"
          : "width 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        ...(isMobile ? {
          position:  "fixed" as const,
          top:       0,
          [isRTL ? "right" : "left"]: 0,
          zIndex:    1000,
          width:     240,
          transform: mobileOpen
            ? "translateX(0)"
            : (isRTL ? "translateX(100%)" : "translateX(-100%)"),
          boxShadow: mobileOpen
            ? `${isRTL ? "-4px" : "4px"} 0 32px rgba(0,0,0,0.35)`
            : "none",
        } : {}),
      }}
    >
      {/* Portal header */}
      <div
        style={{
          padding:        isCollapsed ? "18px 0" : "18px 16px",
          borderBottom:   "1px solid var(--border)",
          display:        "flex",
          alignItems:     "center",
          gap:            10,
          justifyContent: isCollapsed ? "center" : "flex-start",
          minHeight:      64,
          transition:     "padding 220ms ease",
          overflow:       "hidden",
        }}
      >
        {/* Collapsed: show initial */}
        {isCollapsed && (
          <div style={{
            flexShrink:      0,
            width:           32,
            height:          32,
            borderRadius:    8,
            background:      "rgba(212,148,31,0.12)",
            color:           "var(--primary)",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            fontFamily:      "var(--font-display)",
            fontSize:        13,
            fontWeight:      800,
            letterSpacing:   "0.02em",
          }}>
            {PORTAL_INITIALS[portal]}
          </div>
        )}

        {/* Expanded: full text */}
        <div
          style={{
            opacity:    isCollapsed ? 0 : 1,
            maxWidth:   isCollapsed ? 0 : 200,
            overflow:   "hidden",
            whiteSpace: "nowrap",
            transition: "opacity 180ms ease, max-width 220ms ease",
          }}
        >
          <p style={{
            fontSize:      13,
            fontWeight:    800,
            fontFamily:    "var(--font-display)",
            color:         "var(--primary)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            margin:        0,
            lineHeight:    1.2,
          }}>
            {PORTAL_LABELS[portal]}
          </p>
          <p style={{
            fontSize:      9,
            fontFamily:    "var(--font-mono)",
            color:         "var(--text-muted)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            margin:        "3px 0 0",
          }}>
            Terminal
          </p>
        </div>
      </div>

      {/* Nav items */}
      <motion.nav
        variants={navContainerVariants}
        initial={shouldReduce ? false : "hidden"}
        animate="visible"
        style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 0" }}
      >
        {visible.map(item => {
          const Icon     = ICON_MAP[item.key] ?? Package
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

          return (
            <motion.div key={item.key} variants={navItemVariants}>
              <NavLink
                href={item.href}
                label={item.label}
                icon={Icon}
                isActive={isActive}
                collapsed={isCollapsed}
                onClick={isMobile ? onMobileClose : undefined}
              />
            </motion.div>
          )
        })}
      </motion.nav>

      {/* User identity chip - above collapse toggle */}
      {!isMobile && (
        <div style={{
          borderTop:  "1px solid var(--border)",
          padding:    isCollapsed ? "10px 0" : "10px 12px",
          display:    "flex",
          alignItems: "center",
          gap:        8,
          justifyContent: isCollapsed ? "center" : "flex-start",
          overflow:   "hidden",
          minHeight:  50,
          transition: "padding 220ms ease",
        }}>
          {/* Initials circle */}
          <div style={{
            flexShrink:      0,
            width:           28,
            height:          28,
            borderRadius:    "50%",
            background:      "color-mix(in srgb, var(--primary) 15%, transparent)",
            color:           "var(--primary)",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            fontFamily:      "var(--font-display)",
            fontSize:        11,
            fontWeight:      800,
          }}>
            {userInitials}
          </div>

          {/* Name - hidden when collapsed */}
          <span style={{
            opacity:      isCollapsed ? 0 : 1,
            maxWidth:     isCollapsed ? 0 : 180,
            overflow:     "hidden",
            whiteSpace:   "nowrap",
            textOverflow: "ellipsis",
            fontSize:     12,
            fontWeight:   500,
            color:        "var(--text-muted)",
            transition:   "opacity 180ms ease, max-width 220ms ease",
          }}>
            {userName}
          </span>
        </div>
      )}

      {/* Collapse toggle - desktop only */}
      {!isMobile && (
        <div
          style={{
            borderTop:  "1px solid var(--border)",
            padding:    "10px 12px",
            display:    "flex",
            justifyContent: collapsed ? "center" : (isRTL ? "flex-start" : "flex-end"),
          }}
        >
          <button
            onClick={toggle}
            title={collapsed ? "Expand" : "Collapse"}
            style={{
              width:          32,
              height:         32,
              borderRadius:   8,
              border:         "1px solid var(--border)",
              background:     "transparent",
              color:          "var(--text-muted)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              cursor:         "pointer",
              flexShrink:     0,
              transition:     "color 150ms ease, border-color 150ms ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color       = "var(--primary)"
              e.currentTarget.style.borderColor = "var(--primary)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color       = "var(--text-muted)"
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
        display:           "flex",
        alignItems:        "center",
        gap:               10,
        padding:           collapsed ? "10px 0" : "9px 16px",
        justifyContent:    collapsed ? "center" : "flex-start",
        fontSize:          13.5,
        fontWeight:        isActive ? 700 : 400,
        fontFamily:        "var(--font-display)",
        color:             isActive ? "var(--primary)" : "var(--text-muted)",
        textDecoration:    "none",
        borderInlineStart: isActive ? "3px solid var(--primary)" : "3px solid transparent",
        background:        isActive
          ? "color-mix(in srgb, var(--primary) 9%, transparent)"
          : "transparent",
        transition:        "all 150ms ease",
        whiteSpace:        "nowrap",
        overflow:          "hidden",
        letterSpacing:     isActive ? "0.01em" : "0",
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.color      = "var(--text)"
          e.currentTarget.style.background = "var(--surface-2)"
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.color      = "var(--text-muted)"
          e.currentTarget.style.background = "transparent"
        }
      }}
    >
      <Icon size={15} strokeWidth={isActive ? 2.25 : 1.75} style={{ flexShrink: 0 }} />
      <span
        style={{
          opacity:    collapsed ? 0 : 1,
          maxWidth:   collapsed ? 0 : 200,
          overflow:   "hidden",
          transition: "opacity 180ms ease, max-width 220ms ease",
        }}
      >
        {label}
      </span>
    </Link>
  )
}
