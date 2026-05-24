"use server"

import { cookies } from "next/headers"
import { prisma }  from "@/lib/db/prisma"
import { verifyPin } from "@/lib/auth/pin"

const ADMIN_LOCK_COOKIE = "lm3allem_admin_pin"
const MAX_ATTEMPTS      = 3
const LOCKOUT_MS        = 30_000   // 30 s
const WINDOW_MAX_AGE    = 300      // cookie TTL (s)

interface LockState {
  attempts:    number
  lockedUntil: number | null
}

async function readLock(): Promise<LockState> {
  const store = await cookies()
  const raw   = store.get(ADMIN_LOCK_COOKIE)?.value
  if (!raw) return { attempts: 0, lockedUntil: null }
  try {
    const parsed = JSON.parse(raw) as LockState
    if (typeof parsed.attempts !== "number") return { attempts: 0, lockedUntil: null }
    return parsed
  } catch {
    return { attempts: 0, lockedUntil: null }
  }
}

async function writeLock(state: LockState): Promise<void> {
  const store   = await cookies()
  const maxAge  = state.lockedUntil
    ? Math.ceil((state.lockedUntil - Date.now()) / 1000) + 120
    : WINDOW_MAX_AGE

  store.set(ADMIN_LOCK_COOKIE, JSON.stringify(state), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge,
    path:     "/",
  })
}

// ── verifyAdminPin ─────────────────────────────────
export async function verifyAdminPin(
  pin: string
): Promise<{ adminId: string } | { error: string; lockedUntil?: number }> {
  const state = await readLock()

  // Hard-locked?
  if (state.lockedUntil !== null) {
    if (Date.now() < state.lockedUntil) {
      return { error: "locked", lockedUntil: state.lockedUntil }
    }
    // Lockout expired — reset and continue
    state.attempts    = 0
    state.lockedUntil = null
    await writeLock(state)
  }

  // Load all active admins + superadmins
  const admins = await prisma.user.findMany({
    where:  { isActive: true, role: { in: ["admin", "superadmin"] } },
    select: { id: true, pin: true },
  })

  for (const admin of admins) {
    const match = await verifyPin(pin, admin.pin)
    if (match) {
      // Clear lockout on success
      await writeLock({ attempts: 0, lockedUntil: null })
      return { adminId: admin.id }
    }
  }

  // Wrong PIN — record failure
  const next = state.attempts + 1
  if (next >= MAX_ATTEMPTS) {
    const until = Date.now() + LOCKOUT_MS
    await writeLock({ attempts: next, lockedUntil: until })
    return { error: "locked", lockedUntil: until }
  }

  await writeLock({ attempts: next, lockedUntil: null })
  return { error: "invalid" }
}