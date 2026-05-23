import { cookies } from "next/headers"

interface LockState {
  attempts: number
  lockedUntil: number | null // unix ms
}

const COOKIE      = "lm3allem_pin"
const MAX         = 3
const LOCKOUT_MS  = 30_000
const WINDOW_S    = 300 // 5-min attempt window before cookie auto-expires

async function read(): Promise<LockState> {
  const store = await cookies()
  const raw = store.get(COOKIE)?.value
  if (!raw) return { attempts: 0, lockedUntil: null }
  try {
    const parsed = JSON.parse(raw) as LockState
    if (typeof parsed.attempts !== "number") return { attempts: 0, lockedUntil: null }
    return parsed
  } catch {
    return { attempts: 0, lockedUntil: null }
  }
}

async function write(state: LockState): Promise<void> {
  const store = await cookies()
  const maxAge = state.lockedUntil
    ? Math.ceil((state.lockedUntil - Date.now()) / 1000) + 120
    : WINDOW_S
  store.set(COOKIE, JSON.stringify(state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge,
    path: "/",
  })
}

export async function clearLockState(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE)
}

export async function getInitialLockoutState(): Promise<{
  isLocked: boolean
  lockedUntil: number | null
  attemptsLeft: number
}> {
  const state = await read()
  const nowLocked =
    state.lockedUntil !== null && Date.now() < state.lockedUntil

  // Auto-reset if lockout window has elapsed
  if (state.lockedUntil !== null && !nowLocked) {
    await write({ attempts: 0, lockedUntil: null })
    return { isLocked: false, lockedUntil: null, attemptsLeft: MAX }
  }

  return {
    isLocked: nowLocked,
    lockedUntil: nowLocked ? state.lockedUntil : null,
    attemptsLeft: Math.max(0, MAX - state.attempts),
  }
}

export async function checkLock(): Promise<{
  locked: boolean
  lockedUntil: number | null
}> {
  const state = await read()
  if (!state.lockedUntil) return { locked: false, lockedUntil: null }
  if (Date.now() >= state.lockedUntil) {
    await write({ attempts: 0, lockedUntil: null })
    return { locked: false, lockedUntil: null }
  }
  return { locked: true, lockedUntil: state.lockedUntil }
}

export async function recordFail(): Promise<{
  nowLocked: boolean
  lockedUntil: number | null
  attemptsLeft: number
}> {
  const state = await read()

  // Reset if prior lockout expired
  if (state.lockedUntil !== null && Date.now() >= state.lockedUntil) {
    state.attempts = 0
    state.lockedUntil = null
  }

  const next = state.attempts + 1

  if (next >= MAX) {
    const until = Date.now() + LOCKOUT_MS
    await write({ attempts: next, lockedUntil: until })
    return { nowLocked: true, lockedUntil: until, attemptsLeft: 0 }
  }

  await write({ attempts: next, lockedUntil: null })
  return { nowLocked: false, lockedUntil: null, attemptsLeft: MAX - next }
}