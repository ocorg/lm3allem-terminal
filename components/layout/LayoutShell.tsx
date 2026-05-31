"use client"
import { useState, useEffect, type ReactNode } from "react"
import Sidebar  from "@/components/layout/Sidebar"
import Topbar   from "@/components/layout/Topbar"
import { useBreakpoint } from "@/hooks/useBreakpoint"
import type { NavItem } from "@/lib/utils/nav"
import type { Portal, Role } from "@prisma/client"

interface Props {
  portal:          Portal
  locale:          string
  userName:        string
  role:            Role
  canSwitchPortal: boolean
  navItems:        NavItem[]
  children:        ReactNode
}

export default function LayoutShell({
  portal,
  locale,
  userName,
  role,
  canSwitchPortal,
  navItems,
  children,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isMobile } = useBreakpoint()

  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  return (
    <div
      style={{
        display:    "flex",
        height:     "100vh",
        overflow:   "hidden",
        background: "var(--bg)",
      }}
    >
      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position:       "fixed",
            inset:          0,
            background:     "rgba(0,0,0,0.55)",
            zIndex:         999,
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      <Sidebar
        portal={portal}
        navItems={navItems}
        locale={locale}
        userName={userName}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        style={{
          flex:      1,
          display:   "flex",
          flexDirection: "column",
          overflow:  "hidden",
          minWidth:  0,
        }}
      >
        <Topbar
          portal={portal}
          userName={userName}
          role={role}
          locale={locale}
          canSwitchPortal={canSwitchPortal}
          isMobile={isMobile}
          onMobileMenuToggle={() => setMobileOpen(prev => !prev)}
        />
        <main
          style={{
            flex:      1,
            overflowY: "auto",
            padding:   isMobile ? 12 : 24,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
