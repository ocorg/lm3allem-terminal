import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/db/prisma"
import { verifyPin } from "@/lib/auth/pin"
import type { Role, Portal, Language, Theme } from "@prisma/client"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "PIN",
      credentials: {
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.pin || typeof credentials.pin !== "string") return null

        const users = await prisma.user.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            pin: true,
            role: true,
            portalAccess: true,
            modulePermissions: true,
            preferredLanguage: true,
            preferredTheme: true,
          },
        })

        for (const user of users) {
          const valid = await verifyPin(credentials.pin, user.pin)
          if (valid) {
            return {
              id: user.id,
              name: user.name,
              role: user.role,
              portalAccess: user.portalAccess,
              modulePermissions: user.modulePermissions as Record<string, Record<string, boolean>> | null,
              preferredLanguage: user.preferredLanguage,
              preferredTheme: user.preferredTheme,
            }
          }
        }

        return null
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id               = user.id!
        token.role             = (user as any).role as Role
        token.portalAccess     = (user as any).portalAccess as Portal[]
        token.modulePermissions= (user as any).modulePermissions
        token.preferredLanguage= (user as any).preferredLanguage as Language
        token.preferredTheme   = (user as any).preferredTheme as Theme
      }
      return token
    },
    async session({ session, token }) {
      session.user.id                = token.id
      session.user.role              = token.role as Role
      session.user.portalAccess      = token.portalAccess as Portal[]
      session.user.modulePermissions = token.modulePermissions as Record<string, Record<string, boolean>> | null
      session.user.preferredLanguage = token.preferredLanguage as Language
      session.user.preferredTheme    = token.preferredTheme as Theme
      return session
    },
  },
  pages: {
    signIn: "/",
  },
  trustHost: true,
})