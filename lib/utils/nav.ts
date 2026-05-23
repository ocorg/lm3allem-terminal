import type { Portal, Role } from "@prisma/client"

export interface NavConfigItem {
  key: string        // Used for icon lookup and translation key
  path: string       // URL segment e.g. "pos" → /${locale}/${portal}/pos
  module: string | null  // modulePermissions key; null = always visible
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
    { key: "requests",  path: "requests",  module: "produits_demandes" },
    { key: "catalogue", path: "catalogue", module: null },
  ],
  costumes: [
    { key: "pos",       path: "pos",       module: "pos" },
    { key: "inventory", path: "inventory", module: "inventory" },
    { key: "clients",   path: "clients",   module: "clients" },
    { key: "catalogue", path: "catalogue", module: null },
    { key: "caisse",    path: "caisse",    module: "caisse" },
  ],
  lm3allem: [
    { key: "dashboard", path: "dashboard", module: null },
    { key: "finances",  path: "finances",  module: null },
    { key: "caisse",    path: "caisse",    module: null },
    { key: "expenses",  path: "expenses",  module: null },
    { key: "users",     path: "users",     module: null },
    { key: "logs",      path: "logs",      module: null },
    { key: "options",   path: "options",   module: null },
    { key: "settings",  path: "settings",  module: null },
    { key: "alerts",    path: "alerts",    module: null },
  ],
}

export function buildNavItems(params: {
  portal: Portal
  role: Role
  modulePermissions: Record<string, Record<string, boolean>> | null
  getLabel: (key: string) => string
  locale: string
}): NavItem[] {
  const { portal, role, modulePermissions, getLabel, locale } = params
  const isStaff = role === "staff"
  const perms = modulePermissions?.[portal] ?? {}

  return NAV_CONFIG[portal].map(item => ({
    ...item,
    label: getLabel(item.key),
    href: `/${locale}/${portal}/${item.path}`,
    visible: !isStaff || item.module === null || (perms[item.module] ?? false),
  }))
}