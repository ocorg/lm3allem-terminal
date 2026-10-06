import type { Role, Portal, Language, Theme } from "@prisma/client"
import type { ModulePermissions } from "@/lib/permissions"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: Role
      portalAccess: Portal[]
      modulePermissions: ModulePermissions
      preferredLanguage: Language
      preferredTheme: Theme
      mustChangePassword: boolean
    }
  }

  interface User {
    role: Role
    portalAccess: Portal[]
    modulePermissions: ModulePermissions
    preferredLanguage: Language
    preferredTheme: Theme
    mustChangePassword: boolean
  }
}

// Auth.js v5 declares JWT in @auth/core: augmenting "next-auth/jwt" alone does not reach it.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string
    role: Role
    portalAccess: Portal[]
    modulePermissions: ModulePermissions
    preferredLanguage: Language
    preferredTheme: Theme
    mustChangePassword: boolean
    /** epoch ms of the last database re-validation */
    checkedAt: number
  }
}
