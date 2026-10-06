import type { ReactNode } from "react"
import type { Portal, Role } from "@prisma/client"
import { getActiveSession } from "@/lib/actions/caisse"
import { CaisseProvider }   from "./CaisseProvider"
import { CaisseClosedView } from "./CaisseClosedView"
import React from "react"

interface CaisseGuardProps {
  portal:   Portal
  locale:   string
  role:     Role
  children: ReactNode
  /**
   * optional: render the children even when the caisse is closed (they receive a null session
   * and must disable money operations themselves). Used by the rentals screen so a booking can be
   * looked up while the register is closed.
   */
  optional?: boolean
}

/**
 * Server component - reads the active caisse session for the given portal.
 *
 * • No session + admin/ghost → renders CaisseClosedView with trigger button.
 * • No session + staff       → renders CaisseClosedView with info message only.
 * • Session open             → wraps children in CaisseProvider (context).
 */
export async function CaisseGuard({
  portal,
  locale,
  role,
  children,
  optional = false,
}: CaisseGuardProps) {
  const session = await getActiveSession(portal)

  if (!session) {
    if (optional) return <CaisseProvider session={null}>{children}</CaisseProvider>
    return (
      <CaisseClosedView
        portal={portal}
        locale={locale}
        role={role}
      />
    )
  }

  return (
    <CaisseProvider session={session}>
      {children}
    </CaisseProvider>
  )
}
