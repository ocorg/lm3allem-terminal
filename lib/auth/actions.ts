"use server"

import { signIn, signOut } from "@/lib/auth/auth"
import { AuthError } from "next-auth"
import {
  checkLock,
  recordFail,
  clearLockState,
} from "@/lib/auth/pin-lockout"

export type PinResult =
  | { ok: true }
  | { ok: false; error: "locked";       lockedUntil: number }
  | { ok: false; error: "invalid_pin";  attemptsLeft: number }

export async function authenticateWithPin(
  pin: string,
  locale: string
): Promise<PinResult> {
  // ── 1. Server-side lockout check (cannot be bypassed by client) ──
  const lock = await checkLock()
  if (lock.locked) {
    return { ok: false, error: "locked", lockedUntil: lock.lockedUntil! }
  }

  // ── 2. Attempt auth ──────────────────────────────────────────────
  try {
    await signIn("credentials", {
      pin,
      redirectTo: `/${locale}/select-portal`,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      const result = await recordFail()
      if (result.nowLocked) {
        return { ok: false, error: "locked", lockedUntil: result.lockedUntil! }
      }
      return {
        ok: false,
        error: "invalid_pin",
        attemptsLeft: result.attemptsLeft,
      }
    }
    // Re-throw — Next.js redirect errors must propagate
    throw error
  }

  return { ok: true }
}

export async function signOutUser(locale: string): Promise<void> {
  await clearLockState() // Reset attempt counter on logout
  await signOut({ redirectTo: `/${locale}` })
}