import { Prisma } from "@prisma/client"

/** Western digits for Arabic-Indic (٠-٩) and Persian (۰-۹) digits, "," and "٫" as decimal separators. */
export function normalizeNumericInput(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫٬,]/g, ".")
    .replace(/\s+/g, "")
}

/** Parse a user-typed amount. Returns NaN when it is not a valid number. */
export function parseAmount(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return NaN
  if (typeof raw === "number") return raw
  const cleaned = normalizeNumericInput(raw)
  if (cleaned === "" || !/^-?\d*\.?\d+$/.test(cleaned)) return NaN
  return Number(cleaned)
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** True for a finite number with at most 2 decimals, within [min, 100 000 000]. */
export function isValidMoney(n: unknown, opts: { min?: number } = {}): n is number {
  if (typeof n !== "number" || !Number.isFinite(n)) return false
  if (n < (opts.min ?? 0) || n > 100_000_000) return false
  return Math.abs(round2(n) - n) < 1e-9
}

export type DecimalLike = Prisma.Decimal | number | string | null | undefined

export function D(v: DecimalLike): Prisma.Decimal {
  if (v === null || v === undefined) return new Prisma.Decimal(0)
  return v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v)
}

export function sumDecimals(values: DecimalLike[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(D(v)), new Prisma.Decimal(0))
}

/** Decimal -> number rounded to 2 places (for display payloads only). */
export function toNum(v: DecimalLike): number {
  return round2(D(v).toNumber())
}
