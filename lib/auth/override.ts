import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Manager override for sales below the minimum price.
 *
 * An admin authenticates (email + password) in the browser; the server answers with a short-lived,
 * HMAC-signed token bound to (admin, cashier). The sale action verifies the token itself, so the
 * "authorized by" value can no longer be forged by the client.
 */

const TTL_MS = 5 * 60_000

function secret(): string {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error("AUTH_SECRET is not set")
  return s
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

export function signOverrideToken(adminId: string, cashierId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ a: adminId, c: cashierId, e: Date.now() + TTL_MS })
  ).toString("base64url")
  return `${payload}.${sign(payload)}`
}

/** Returns the authorizing admin id, or null when the token is missing, forged, expired or for another cashier. */
export function verifyOverrideToken(token: string | undefined | null, cashierId: string): string | null {
  if (!token) return null
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null

  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null

  try {
    const { a, c, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      a: string; c: string; e: number
    }
    if (c !== cashierId || typeof e !== "number" || e < Date.now()) return null
    return a
  } catch {
    return null
  }
}
