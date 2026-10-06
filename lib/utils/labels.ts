/** Arabic names for the internal codes. One place, so no screen ever shows "magazin" or "cash". */

const PORTALS: Record<string, string> = { magazin: "المتجر", costumes: "البدلات", lm3allem: "الإدارة" }

const PAYMENT_METHODS: Record<string, string> = {
  cash:   "نقدا",
  tpe:    "بطاقة بنكية",
  banque: "تحويل بنكي",
  credit: "آجل",
}

export function portalLabel(portal: string | null | undefined): string {
  return portal ? (PORTALS[portal] ?? portal) : "-"
}

export function paymentMethodLabel(method: string | null | undefined): string {
  return method ? (PAYMENT_METHODS[method] ?? method) : "-"
}
