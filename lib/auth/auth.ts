import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/db/prisma"
import { verifyCredentials } from "@/lib/auth/credentials"
import { normalizePermissions } from "@/lib/permissions"

/** How long a token is trusted before role / permissions / active flag are re-read from the database. */
const REFRESH_MS = 30_000
const SESSION_MAX_AGE_S = 12 * 60 * 60

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_S },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email    = credentials?.email
        const password = credentials?.password
        if (typeof email !== "string" || typeof password !== "string" || !email || !password) return null

        const result = await verifyCredentials(email, password)
        if (!result.ok) return null

        const { user } = result
        return {
          id:                 user.id,
          name:               user.name,
          email:              user.email,
          role:               user.role,
          portalAccess:       user.portalAccess,
          modulePermissions:  user.modulePermissions,
          preferredLanguage:  user.preferredLanguage,
          preferredTheme:     user.preferredTheme,
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Sign-in: copy everything from the authenticated user.
      if (user) {
        token.id                 = user.id!
        token.role               = user.role
        token.portalAccess       = user.portalAccess
        token.modulePermissions  = user.modulePermissions
        token.preferredLanguage  = user.preferredLanguage
        token.preferredTheme     = user.preferredTheme
        token.mustChangePassword = user.mustChangePassword
        token.checkedAt          = Date.now()
        return token
      }

      if (!token.id) return null

      // Later requests: re-validate against the database so deactivation, role and permission
      // changes take effect within seconds instead of at the next login.
      const stale = Date.now() - (token.checkedAt ?? 0) > REFRESH_MS
      if (stale || token.mustChangePassword) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            isActive: true, role: true, name: true, email: true, portalAccess: true,
            modulePermissions: true, preferredLanguage: true, preferredTheme: true,
            mustChangePassword: true,
          },
        })
        if (!fresh || !fresh.isActive) return null // ends the session

        token.name               = fresh.name
        token.email              = fresh.email
        token.role               = fresh.role
        token.portalAccess       = fresh.portalAccess
        token.modulePermissions  = normalizePermissions(fresh.modulePermissions)
        token.preferredLanguage  = fresh.preferredLanguage
        token.preferredTheme     = fresh.preferredTheme
        token.mustChangePassword = fresh.mustChangePassword
        token.checkedAt          = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      session.user.id                 = token.id
      session.user.role               = token.role
      session.user.portalAccess       = token.portalAccess
      session.user.modulePermissions  = token.modulePermissions
      session.user.preferredLanguage  = token.preferredLanguage
      session.user.preferredTheme     = token.preferredTheme
      session.user.mustChangePassword = token.mustChangePassword
      return session
    },
  },
  pages: { signIn: "/" },
  trustHost: true,
})
