import type { Portal, Role } from "@prisma/client"

/**
 * Single source of truth for roles, portals and modules.
 *
 *   ghost  - invisible full-permission account (maintenance / verification). Not creatable from the UI.
 *   admin  - full access to every portal and module.
 *   staff  - access limited to `portalAccess` + `modulePermissions`.
 */

export const ASSIGNABLE_ROLES = ["admin", "staff"] as const
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

/** Modules that can be toggled per staff user, per portal. The lm3allem portal is admin-only. */
export const PORTAL_MODULES = {
  magazin:  ["pos", "inventory", "caisse", "credits", "requests"],
  costumes: ["pos", "rentals", "rental_inventory", "clients", "caisse"],
} as const satisfies Record<string, readonly string[]>

export type ModulePermissions = Record<string, Record<string, boolean>>

/** Modules every portal member may open without an explicit permission. */
export const OPEN_MODULES = ["catalogue"] as const

export const DEFAULT_STAFF_PERMISSIONS: ModulePermissions = {
  magazin:  { pos: true, inventory: false, caisse: false, credits: true,  requests: true  },
  costumes: { pos: true, rentals: true, rental_inventory: false, clients: true, caisse: false },
}

export function isAdminRole(role: Role | string | null | undefined): boolean {
  return role === "admin" || role === "ghost"
}

export function isGhost(role: Role | string | null | undefined): boolean {
  return role === "ghost"
}

const LEGACY_MODULE_ALIASES: Record<string, string> = {
  produits_demandes: "requests",
}

/**
 * Accepts the stored JSON (possibly legacy / malformed) and returns a clean
 * `{ portal: { module: boolean } }` object containing only known portals and modules.
 * Legacy flat shapes ({ pos: true }) are ignored: they never matched any check.
 */
export function normalizePermissions(raw: unknown): ModulePermissions {
  const out: ModulePermissions = {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out

  for (const portal of Object.keys(PORTAL_MODULES) as (keyof typeof PORTAL_MODULES)[]) {
    const src = (raw as Record<string, unknown>)[portal]
    if (!src || typeof src !== "object" || Array.isArray(src)) continue
    const allowed: readonly string[] = PORTAL_MODULES[portal]
    const clean: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(src as Record<string, unknown>)) {
      const mod = LEGACY_MODULE_ALIASES[key] ?? key
      if (allowed.includes(mod) && typeof value === "boolean") clean[mod] = value
    }
    out[portal] = clean
  }
  return out
}

export interface AccessSubject {
  role: Role
  portalAccess: Portal[]
  modulePermissions: ModulePermissions | null
}

export function canAccessPortal(user: AccessSubject, portal: Portal): boolean {
  if (portal === "lm3allem") return isAdminRole(user.role)
  if (isAdminRole(user.role)) return true
  return user.portalAccess.includes(portal)
}

export function canAccessModule(user: AccessSubject, portal: Portal, module: string): boolean {
  if (!canAccessPortal(user, portal)) return false
  if (isAdminRole(user.role)) return true
  if ((OPEN_MODULES as readonly string[]).includes(module)) return true
  return user.modulePermissions?.[portal]?.[module] === true
}
