import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Manager override: an admin approves something a cashier may not do alone.
 *
 * An admin authenticates (email + password) in the browser; the server answers with a short-lived,
 * HMAC-signed token bound to (admin, cashier, scope). The action verifies the token itself, so the
 * "authorized by" value can never be forged by the client.
 *
 * Scopes keep approvals apart: a discount approval cannot be used for a return, and a return
 * approval only works for the one sale it was given for.
 *   - "below_min"          a sale under the minimum price (several items of the same sale)
 *   - "return:<saleId>"    a return on that sale
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

export const BELOW_MIN_SCOPE = "below_min"
export const returnScope = (saleId: string) => `return:${saleId}`

export function signOverrideToken(adminId: string, cashierId: string, scope: string): string {
  const payload = Buffer.from(
    JSON.stringify({ a: adminId, c: cashierId, s: scope, e: Date.now() + TTL_MS })
  ).toString("base64url")
  return `${payload}.${sign(payload)}`
}

/** Returns the authorizing admin id, or null when the token is missing, forged, expired, for another cashier or another purpose. */
export function verifyOverrideToken(token: string | undefined | null, cashierId: string, scope: string): string | null {
  if (!token) return null
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null

  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null

  try {
    const { a, c, s, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      a: string; c: string; s?: string; e: number
    }
    if (c !== cashierId || s !== scope || typeof e !== "number" || e < Date.now()) return null
    return a
  } catch {
    return null
  }
}
