/**
 * Format a number as MAD currency.
 * Accepts number, string, or Prisma Decimal (which has a toString() method).
 */
export function formatMAD(amount: number | string | { toString(): string }): string {
  const num = parseFloat(amount.toString())
  if (isNaN(num)) return "- MAD"

  return new Intl.NumberFormat("fr-MA", {
    style:                 "currency",
    currency:              "MAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^\d.-]/g, "")) || 0
}