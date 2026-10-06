"use client"
import React, { useMemo, useState, type ReactNode } from "react"
import Sidebar  from "@/components/layout/Sidebar"
import Topbar   from "@/components/layout/Topbar"
import { useBreakpoint } from "@/hooks/useBreakpoint"
import OfflineWarmup from "@/components/system/OfflineWarmup"
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
  const [mobileOpenRaw, setMobileOpen] = useState(false)
  const { isMobile } = useBreakpoint()
  // The drawer can only be open on a mobile viewport (derived: no effect needed to close it on resize)
  const mobileOpen = isMobile && mobileOpenRaw

  // The till page of this portal is opened quietly in the background: offline copy + warm server
  const warmUrls = useMemo(() => navItems.filter((i) => i.visible && i.key === "pos").map((i) => i.href), [navItems])

  return (
    <div
      style={{
        display:    "flex",
        height:     "100vh",
        overflow:   "hidden",
        background: "var(--bg)",
      }}
    >
      <OfflineWarmup urls={warmUrls} />

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
            overflowX: "hidden",
            minWidth:  0,
            padding:   isMobile ? 12 : 24,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
