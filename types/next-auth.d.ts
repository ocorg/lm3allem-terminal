import type { Role, Portal, Language, Theme } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      role: Role
      portalAccess: Portal[]
      modulePermissions: Record<string, Record<string, boolean>> | null
      preferredLanguage: Language
      preferredTheme: Theme
    }
  }

  interface User {
    role: Role
    portalAccess: Portal[]
    modulePermissions: Record<string, Record<string, boolean>> | null
    preferredLanguage: Language
    preferredTheme: Theme
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: Role
    portalAccess: Portal[]
    modulePermissions: Record<string, Record<string, boolean>> | null
    preferredLanguage: Language
    preferredTheme: Theme
  }
}