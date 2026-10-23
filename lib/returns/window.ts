/**
 * Return period rules, safe for both the server and the browser (no database access here).
 * The number of days itself is a setting: read it with getReturnWindowDays (lib/returns/policy.ts).
 */

export const DEFAULT_RETURN_WINDOW_DAYS = 7
export const MIN_RETURN_WINDOW_DAYS = 1
export const MAX_RETURN_WINDOW_DAYS = 365

const DAY_MS = 86_400_000

/** Last moment a sale can be returned by staff: the same time of day, N days later. */
export function returnDeadline(saleCreatedAt: Date | string, windowDays: number): Date {
  return new Date(new Date(saleCreatedAt).getTime() + windowDays * DAY_MS)
}

export function isWithinReturnWindow(saleCreatedAt: Date | string, windowDays: number, now: Date = new Date()): boolean {
  return now.getTime() <= returnDeadline(saleCreatedAt, windowDays).getTime()
}

/** How a sale's money came in, which is also how a correction gives it back. */
export function saleMoneyMethod(paymentMethod: string): "cash" | "tpe" | "banque" {
  // a credit sale's advance is handed over in cash (same rule as the till, lib/finance/caisse.ts)
  return paymentMethod === "tpe" || paymentMethod === "banque" ? paymentMethod : "cash"
}

/**
 * Splits the value of returned goods between the customer's debt and money handed back.
 * A credit sale first cancels what is still owed; only what was already paid comes back.
 */
export function splitReturnValue(value: number, debtBalance: number): { debtReduction: number; refund: number } {
  const debtReduction = Math.max(0, Math.min(value, debtBalance))
  return { debtReduction: round2(debtReduction), refund: round2(value - debtReduction) }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
