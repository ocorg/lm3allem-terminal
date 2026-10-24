import { createHash } from "node:crypto"
import { prisma } from "@/lib/db/prisma"
import { normalizeEmail, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password"
import { normalizePermissions, type ModulePermissions } from "@/lib/permissions"
import type { Language, Portal, Role, Theme } from "@prisma/client"
import { alertAccount } from "@/lib/notifications/alerts"

export const MAX_FAILED_ATTEMPTS = 5
export const LOCKOUT_MS = 5 * 60_000

export interface AuthenticatedUser {
  id:                 string
  name:               string
  email:              string
  role:               Role
  portalAccess:       Portal[]
  modulePermissions:  ModulePermissions
  preferredLanguage:  Language
  preferredTheme:     Theme
  mustChangePassword: boolean
  passwordVersion:    string
}

/**
 * A short fingerprint of the stored password hash. It travels inside the (encrypted) session; when
 * the password changes (by its owner or a reset by an admin) the fingerprint no longer matches and
 * every older session ends at its next check.
 */
export function passwordVersion(passwordHash: string | null): string {
  return createHash("sha256").update(`pwv:${passwordHash ?? ""}`).digest("base64url").slice(0, 16)
}

export type CredentialsResult =
  | { ok: true;  user: AuthenticatedUser }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; lockedUntil: Date }

/**
 * The single place where an email/password pair is verified. It also owns the brute-force
 * protection (per-account lockout stored in the database), so the lockout applies to every
 * entry point: the login form, /api/auth/callback/credentials and the manager override.
 */
export async function verifyCredentials(emailRaw: string, password: string): Promise<CredentialsResult> {
  const email = normalizeEmail(emailRaw)
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.passwordHash || !user.isActive) {
    await verifyAgainstDummy(password)
    return { ok: false, reason: "invalid" }
  }

  const now = new Date()
  if (user.lockedUntil && user.lockedUntil > now) {
    return { ok: false, reason: "locked", lockedUntil: user.lockedUntil }
  }

  const valid = await verifyPassword(password, user.passwordHash)

  if (!valid) {
    // A finished lockout starts a fresh attempt window.
    const base = user.lockedUntil && user.lockedUntil <= now ? 0 : user.failedLogins
    const next = base + 1
    if (next >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_MS)
      await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil } })
      if (user.role !== "ghost") await alertAccount("locked", { name: user.name, email: user.email })
      return { ok: false, reason: "locked", lockedUntil }
    }
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: next, lockedUntil: null } })
    return { ok: false, reason: "invalid" }
  }

  await prisma.user.update({
    where: { id: user.id },
    data:  { failedLogins: 0, lockedUntil: null, lastLoginAt: now },
  })

  return {
    ok: true,
    user: {
      id:                 user.id,
      name:               user.name,
      email:              user.email ?? email,
      role:               user.role,
      portalAccess:       user.portalAccess,
      modulePermissions:  normalizePermissions(user.modulePermissions),
      preferredLanguage:  user.preferredLanguage,
      preferredTheme:     user.preferredTheme,
      mustChangePassword: user.mustChangePassword,
      passwordVersion:    passwordVersion(user.passwordHash),
    },
  }
}
