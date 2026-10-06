import bcrypt from "bcryptjs"
import { createHmac, randomInt } from "node:crypto"

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password-rules"

export { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH }

const SALT_ROUNDS = 12

function pepper(): string {
  return process.env.AUTH_PASSWORD_PEPPER ?? process.env.PIN_HASH_PEPPER ?? ""
}

/**
 * bcrypt only reads the first 72 bytes, so the password is first reduced to a fixed-length
 * HMAC (keyed with the server-side pepper). Long passwords and the pepper are never truncated.
 */
function prehash(password: string): string {
  return createHmac("sha256", pepper()).update(password).digest("base64")
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(prehash(password), SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(prehash(password), hash)
}

let dummyHash: Promise<string> | null = null

/** Burn the same CPU time as a real check so unknown emails cannot be told apart by timing. */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= bcrypt.hash("timing-equaliser", SALT_ROUNDS)
  await bcrypt.compare(prehash(password), await dummyHash)
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email)
}

/** Returns an error code, or null when the password is acceptable. */
export function validatePassword(password: string): "weak_password" | null {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) return "weak_password"
  return null
}

const LOWER = "abcdefghijkmnpqrstuvwxyz"
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const DIGITS = "23456789"
const ALL = LOWER + UPPER + DIGITS

/** Cryptographically random temporary password (no look-alike characters). */
export function generatePassword(length = 12): string {
  const pick = (set: string) => set[randomInt(set.length)]
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)]
  while (chars.length < length) chars.push(pick(ALL))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join("")
}
