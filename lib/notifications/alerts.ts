import type { Portal, Role } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { createNotification } from "@/lib/notifications/create"
import { costumeDetail, variantDetail } from "@/lib/inventory/low-stock"
import { actorLabel } from "@/lib/utils/actor"
import { formatMAD, formatSignedMAD } from "@/lib/utils/currency"
import { defer } from "@/lib/utils/defer"
import { paymentMethodLabel, portalLabel } from "@/lib/utils/labels"
import { toNum } from "@/lib/utils/money"

/**
 * "Something needs a reaction" alerts for the owner (in-app bell + Telegram group).
 *
 * Every function here runs AFTER the answer has gone back to the person at the counter, loads what
 * it needs by id and never throws: an alert that fails must never undo or slow down a sale.
 */

/** A sale, a debt or a refund from this amount up is reported on its own. */
export const BIG_AMOUNT = 1000

type Actor = { id: string; name: string; role: Role | string }

function safely(task: () => Promise<void>): Promise<void> {
  return defer(async () => {
    try { await task() } catch (err) { console.error("[alerts]", err instanceof Error ? err.message : err) }
  })
}

interface SoldLine { label: string; quantity: number; unitPrice: number; listPrice: number; belowMin: boolean; approvedBy: string | null }

async function reportSale(portal: Portal, actor: Actor, total: number, method: string, lines: SoldLine[], credit: { client: string; balance: number } | null) {
  // 1. sold under the minimum price
  const discounted = lines.filter((l) => l.belowMin)
  if (discounted.length > 0) {
    const lost = discounted.reduce((s, l) => s + Math.max(0, l.listPrice - l.unitPrice) * l.quantity, 0)
    await createNotification({
      title:  "بيع بسعر أقل من الحد الأدنى",
      body:   [
        ...discounted.map((l) => `• ${l.label} | الكمية ${l.quantity} | بيع بـ ${formatMAD(l.unitPrice)} بدل ${formatMAD(l.listPrice)}`),
        `البائع: ${actor.name} | التفويض: ${discounted[0].approvedBy ?? "-"}`,
        `مجموع التخفيض: ${formatMAD(lost)}`,
      ].join("\n"),
      type:   "discount",
      portal,
      actor,
    })
  }

  // 2. unusually large sale
  if (total >= BIG_AMOUNT) {
    await createNotification({
      title:  "عملية بيع كبيرة",
      body:   [
        `المبلغ: ${formatMAD(total)} | ${paymentMethodLabel(method)} | البائع: ${actor.name}`,
        ...lines.slice(0, 6).map((l) => `• ${l.label} × ${l.quantity}`),
        ...(lines.length > 6 ? [`وعناصر أخرى: ${lines.length - 6}`] : []),
      ].join("\n"),
      type:   "big_amount",
      portal,
      actor,
    })
  }

  // 3. unusually large debt
  if (credit && credit.balance >= BIG_AMOUNT) {
    await createNotification({
      title:  "دين كبير جديد",
      body:   `العميل: ${credit.client} | المتبقي عليه: ${formatMAD(credit.balance)} من أصل ${formatMAD(total)} | البائع: ${actor.name}`,
      type:   "big_amount",
      portal,
      actor,
    })
  }
}

export function alertShopSale(saleId: string, actor: Actor): Promise<void> {
  return safely(async () => {
    const sale = await prisma.sale.findUnique({
      where:   { id: saleId },
      include: {
        credit: { select: { clientName: true, balance: true } },
        items:  {
          include: {
            authorizedBy: { select: { name: true, role: true } },
            variant: { include: { product: { select: { name_ar: true, sellingPrice: true } }, size: { select: { label_ar: true } }, color: { select: { label_ar: true } } } },
          },
        },
      },
    })
    if (!sale) return
    const lines: SoldLine[] = sale.items.map((i) => ({
      label:      [i.variant.product.name_ar, variantDetail(i.variant)].filter(Boolean).join(" | "),
      quantity:   i.quantity,
      unitPrice:  toNum(i.unitPrice),
      listPrice:  toNum(i.variant.product.sellingPrice),
      belowMin:   i.wasBelowMin,
      approvedBy: i.authorizedBy ? actorLabel(i.authorizedBy) : null,
    }))
    await reportSale("magazin", actor, toNum(sale.totalAmount), sale.paymentMethod, lines,
      sale.credit ? { client: sale.credit.clientName, balance: toNum(sale.credit.balance) } : null)
  })
}

export function alertCostumeSale(saleId: string, actor: Actor): Promise<void> {
  return safely(async () => {
    const sale = await prisma.costumeSale.findUnique({
      where:   { id: saleId },
      include: {
        items: {
          include: {
            authorizedBy: { select: { name: true, role: true } },
            costumeItem:  { include: { size: { select: { label_ar: true } }, pantsSize: { select: { label_ar: true } }, shirtSize: { select: { label_ar: true } }, shoeSize: { select: { label_ar: true } } } },
          },
        },
      },
    })
    if (!sale) return
    const lines: SoldLine[] = sale.items.map((i) => ({
      label:      [i.costumeItem.sku, i.costumeItem.name_ar, costumeDetail(i.costumeItem)].filter(Boolean).join(" | "),
      quantity:   i.quantity,
      unitPrice:  toNum(i.unitPrice),
      listPrice:  toNum(i.costumeItem.sellingPrice ?? i.unitPrice),
      belowMin:   i.wasBelowMin,
      approvedBy: i.authorizedBy ? actorLabel(i.authorizedBy) : null,
    }))
    await reportSale("costumes", actor, toNum(sale.totalAmount), sale.paymentMethod, lines, null)
  })
}

/** The counted cash does not match what the till should hold. */
export function alertTillGap(portal: Portal, actor: Actor, counted: number, expected: number): Promise<void> {
  const gap = Math.round((counted - expected) * 100) / 100
  if (gap === 0) return Promise.resolve()
  return safely(() => createNotification({
    title:  gap < 0 ? "نقص في الصندوق عند الإغلاق" : "زيادة في الصندوق عند الإغلاق",
    body:   `${portalLabel(portal)} | المتوقع: ${formatMAD(expected)} | المعدود: ${formatMAD(counted)} | الفرق: ${formatSignedMAD(gap)} | أغلقه: ${actor.name}`,
    type:   "cash_alert",
    portal,
    actor,
  }))
}

/** Cash taken out of the drawer by hand. */
export function alertCashWithdrawal(portal: Portal, actor: Actor, amount: number, reason: string): Promise<void> {
  if (amount >= 0) return Promise.resolve()
  return safely(() => createNotification({
    title:  "سحب نقدي من الصندوق",
    body:   `${portalLabel(portal)} | المبلغ: ${formatMAD(Math.abs(amount))} | السبب: ${reason} | بواسطة: ${actor.name}`,
    type:   "cash_alert",
    portal,
    actor,
  }))
}

export function alertRentalCancelled(rentalId: string, actor: Actor, reason: string, refund: number): Promise<void> {
  return safely(async () => {
    const rental = await prisma.rental.findUnique({
      where:  { id: rentalId },
      select: { totalAmount: true, amountPaid: true, client: { select: { name: true, phone: true } }, kit: { select: { reference: true } } },
    })
    if (!rental) return
    await createNotification({
      title:  refund > 0 ? "إلغاء إيجار مع استرجاع مبلغ" : "إلغاء إيجار",
      body:   [
        `${rental.kit?.reference ?? "-"} | ${rental.client.name} (${rental.client.phone})`,
        `السبب: ${reason}`,
        refund > 0 ? `المبلغ المسترجع للعميل: ${formatMAD(refund)}` : "بدون استرجاع أي مبلغ",
        `بواسطة: ${actor.name}`,
      ].join("\n"),
      type:   refund >= BIG_AMOUNT ? "big_amount" : "rental",
      portal: "costumes",
      actor,
    })
  })
}

/** New account, password reset, or an account locked after too many wrong passwords. */
export function alertAccount(event: "created" | "password_reset" | "locked", target: { name: string; email?: string | null; role?: string }, actor?: Actor): Promise<void> {
  const title = event === "created" ? "حساب جديد" : event === "password_reset" ? "إعادة تعيين كلمة مرور" : "حساب موقوف مؤقتا"
  const body = event === "locked"
    ? `${target.name} | ${target.email ?? "-"} | خمس محاولات دخول خاطئة متتالية. إن لم يكن صاحب الحساب هو من حاول، غيّر كلمة المرور.`
    : `${target.name} | ${target.email ?? "-"}${target.role ? ` | ${target.role === "admin" ? "مسؤول" : "موظف"}` : ""}${actor ? ` | بواسطة: ${actor.name}` : ""}`
  return safely(() => createNotification({ title, body, type: "account", portal: "lm3allem", actor }))
}
