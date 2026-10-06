import { normalizeNumericInput } from "@/lib/utils/money"

/**
 * Canonical phone form used as the unique key of a client:
 * Western digits only, no spaces / dots / dashes / parentheses, optional leading "+".
 * "06 12-34.56.78" and "٠٦١٢٣٤٥٦٧٨" both become "0612345678".
 */
export function normalizePhone(raw: string): string {
  const digits = normalizeNumericInput(raw).replace(/[().\-/]/g, "")
  return digits.startsWith("+") ? "+" + digits.slice(1).replace(/\D/g, "") : digits.replace(/\D/g, "")
}

export function isValidPhone(normalized: string): boolean {
  const digits = normalized.replace(/\D/g, "")
  return digits.length >= 8 && digits.length <= 15
}
