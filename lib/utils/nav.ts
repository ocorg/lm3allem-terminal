import type { Portal, Role } from "@prisma/client"
import { canAccessModule, type AccessSubject, type ModulePermissions } from "@/lib/permissions"

export interface NavConfigItem {
  key: string        // Used for icon lookup and translation key
  path: string       // URL segment e.g. "pos" → /${locale}/${portal}/pos
  module: string | null  // modulePermissions key; null = always visible to portal members
}

export interface NavItem extends NavConfigItem {
  label: string      // Pre-translated
  href: string       // Full path
  visible: boolean   // Permission-filtered
}

const NAV_CONFIG: Record<Portal, NavConfigItem[]> = {
  magazin: [
    { key: "pos",       path: "pos",       module: "pos" },
    { key: "inventory", path: "inventory", module: "inventory" },
    { key: "caisse",    path: "caisse",    module: "caisse" },
    { key: "credits",   path: "credits",   module: "credits" },
    { key: "requests",  path: "requests",  module: "requests" },
    { key: "catalogue", path: "catalogue", module: null },
  ],
  costumes: [
    { key: "pos",              path: "pos",              module: "pos" },
    { key: "rentals",          path: "rentals",          module: "rentals" },
    { key: "rental_inventory", path: "rental-inventory", module: "rental_inventory" },
    { key: "clients",          path: "clients",          module: "clients" },
    { key: "catalogue",        path: "catalogue",        module: null },
    { key: "caisse",           path: "caisse",           module: "caisse" },
  ],
  lm3allem: [
    { key: "dashboard", path: "dashboard", module: null },
    { key: "finances",  path: "finances",  module: null },
    { key: "caisse",    path: "caisse",    module: null },
    { key: "expenses",  path: "expenses",  module: null },
    { key: "users",     path: "users",     module: null },
    { key: "logs",      path: "logs",      module: null },
    { key: "settings",  path: "settings",  module: null },
    { key: "alerts",    path: "alerts",    module: null },
  ],
}

/**
 * Path segment of the first screen this user may open in a portal (e.g. "pos", or "catalogue"
 * for someone who has no other permission). Used wherever we send a user "into" a portal, so
 * nobody is ever sent to a screen that would bounce them back (an endless loading loop).
 */
export function firstAccessiblePath(
  subject: AccessSubject,
  portal: Portal
): string {
  const item = NAV_CONFIG[portal].find((i) => canAccessModule(subject, portal, i.module ?? "catalogue"))
  return (item ?? NAV_CONFIG[portal][NAV_CONFIG[portal].length - 1]).path
}

export function buildNavItems(params: {
  portal: Portal
  role: Role
  portalAccess: Portal[]
  modulePermissions: ModulePermissions | null
  getLabel: (key: string) => string
  locale: string
}): NavItem[] {
  const { portal, role, portalAccess, modulePermissions, getLabel, locale } = params
  const subject = { role, portalAccess, modulePermissions }

  return NAV_CONFIG[portal].map(item => ({
    ...item,
    label: getLabel(item.key),
    href: `/${locale}/${portal}/${item.path}`,
    // Same rule the pages and the server actions enforce (lib/permissions.ts)
    visible: canAccessModule(subject, portal, item.module ?? "catalogue"),
  }))
}
