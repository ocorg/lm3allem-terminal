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

const REFUND_METHODS: Record<string, string> = {
  cash:   "نقدا من الصندوق",
  tpe:    "على البطاقة البنكية",
  banque: "بتحويل بنكي",
  none:   "بدون حركة مالية",
}

const RETURN_KINDS: Record<string, string> = {
  customer_return: "إرجاع من العميل",
  entry_error:     "تصحيح خطأ في التسجيل",
}

/** How the money of a return went back ("none" = no money moved). */
export function refundMethodLabel(method: string | null | undefined): string {
  return method ? (REFUND_METHODS[method] ?? method) : "-"
}

export function returnKindLabel(kind: string | null | undefined): string {
  return kind ? (RETURN_KINDS[kind] ?? kind) : "-"
}
