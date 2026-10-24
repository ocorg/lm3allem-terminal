import { z } from "zod"
import { ActionError } from "@/lib/actions/result"
import { isValidMoney } from "@/lib/utils/money"

/** Shared building blocks for server-side input validation. Never trust the browser's numbers. */

export const id = z.string().min(1).max(64)

/** Non-negative amount with at most 2 decimals. */
export const money = z.number().refine((n) => isValidMoney(n), { message: "invalid amount" })

/** Strictly positive amount with at most 2 decimals. */
export const moneyPositive = z.number().refine((n) => isValidMoney(n) && n > 0, { message: "invalid amount" })

export const paymentMethod = z.enum(["cash", "tpe", "banque", "credit"])
export const settlementMethod = z.enum(["cash", "tpe", "banque"])

export const requestId = z.string().min(8).max(64)

export const optionalText = (max: number) => z.string().trim().max(max).optional()

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new ActionError("validation")
  return parsed.data
}

/**
 * A record id coming from the browser. It must be a plain short string: an object here could be
 * read by the database layer as a filter ("every row where...") instead of one precise record.
 */
export function asId(value: unknown): string {
  return parseInput(id, value)
}

/** "YYYY-MM-DD" (a day picked in a filter). */
export const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/**
 * Filters of a read-only list (they come from the address bar). A malformed value is dropped
 * instead of failing the whole screen, but it never reaches the database as something else.
 */
export function readFilters<S extends z.ZodType>(schema: S, input: unknown): Partial<z.infer<S>> {
  const parsed = schema.safeParse(input ?? {})
  return parsed.success ? parsed.data : {}
}
