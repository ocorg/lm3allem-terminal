"use server"

import { cookies } from "next/headers"
import { AuthError } from "next-auth"
import { signIn, signOut } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/prisma"
import { requireUser } from "@/lib/auth/guard"
import { getLoginState, verifyCredentials } from "@/lib/auth/credentials"
import { hashPassword, isValidEmail, normalizeEmail, validatePassword } from "@/lib/auth/password"
import { fail, ok, run, ActionError, type ActionResult } from "@/lib/actions/result"
import { routing } from "@/lib/i18n/routing"
import { logActivity } from "@/lib/activity/logger"

export type LoginResult =
  | { ok: true }
  | { ok: false; error: "invalid_input" }
  | { ok: false; error: "locked";  lockedUntil: number }
  | { ok: false; error: "invalid"; attemptsLeft: number }

function safeLocale(locale: string): string {
  return (routing.locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale
}

export async function authenticateWithPassword(
  email: string,
  password: string,
  locale: string
): Promise<LoginResult> {
  if (typeof email !== "string" || typeof password !== "string") return { ok: false, error: "invalid_input" }
  const normalized = normalizeEmail(email)
  if (!isValidEmail(normalized) || password.length === 0 || password.length > 128) {
    return { ok: false, error: "invalid_input" }
  }

  try {
    await signIn("credentials", {
      email:      normalized,
      password,
      redirectTo: `/${safeLocale(locale)}/select-portal`,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      const state = await getLoginState(normalized)
      if (state.locked && state.lockedUntil) {
        return { ok: false, error: "locked", lockedUntil: state.lockedUntil }
      }
      return { ok: false, error: "invalid", attemptsLeft: state.attemptsLeft }
    }
    // Re-throw - Next.js redirect errors must propagate
    throw error
  }

  return { ok: true }
}

export async function signOutUser(locale: string): Promise<void> {
  await signOut({ redirectTo: `/${safeLocale(locale)}` })
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ActionResult> {
  return run(async () => {
    const user = await requireUser({ allowPasswordChange: true })
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") throw new ActionError("validation")

    const weak = validatePassword(newPassword)
    if (weak) throw new ActionError(weak)
    if (newPassword === currentPassword) throw new ActionError("validation", "كلمة المرور الجديدة يجب أن تختلف عن الحالية")

    const check = await verifyCredentials(user.email, currentPassword)
    if (!check.ok) throw new ActionError(check.reason === "locked" ? "account_locked" : "invalid_credentials")

    await prisma.user.update({
      where: { id: user.id },
      data:  { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    })

    await logActivity({
      portal: "lm3allem", entityType: "user", entityId: user.id, actor: user, action: "user.password_changed",
    })
  })
}

const THEME_COOKIE = "lm3allem-theme"

/** Persists the theme in the user's profile AND in a cookie so the server renders it without a flash. */
export async function setThemePreference(theme: "dark" | "light"): Promise<ActionResult> {
  if (theme !== "dark" && theme !== "light") return fail("validation")
  const store = await cookies()
  store.set(THEME_COOKIE, theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" })

  return run(async () => {
    const user = await requireUser()
    await prisma.user.update({ where: { id: user.id }, data: { preferredTheme: theme } })
  }).then((r) => (r.ok ? ok() : r))
}
