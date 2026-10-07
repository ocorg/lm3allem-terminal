import { prisma } from "@/lib/db/prisma"
import { AUTO_CLOSE_HOUR } from "@/lib/finance/auto-close"
import { getRevenueRows, type DateWindow } from "@/lib/finance/revenue"
import { getLowStock, lowStockLabel } from "@/lib/inventory/low-stock"
import { getOverdueRentals } from "@/lib/rentals/overdue"
import type { TableSpec } from "@/lib/notifications/table-image"
import { formatMAD, formatNumber, formatSignedMAD } from "@/lib/utils/currency"
import { formatDate, formatDateTime, formatDay } from "@/lib/utils/date"
import { paymentMethodLabel } from "@/lib/utils/labels"
import { toNum } from "@/lib/utils/money"
import { businessClock, dayKey, endOfDay, lastDailyCutoff, startOfDay, todayKey } from "@/lib/utils/time"

/**
 * The owner's reports (Telegram). Every function only READS data and returns plain text, so the
 * same text can be sent by a scheduled job or as the answer to a bot command.
 *
 * A "working day" starts at the hour the till is closed automatically (04:00), so sales made after
 * midnight still belong to the evening that produced them.
 */

const DAY = 86_400_000
const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0)
const count = (n: number) => formatNumber(n).replace(/,00$/, "")
const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "ماي", "يونيو", "يوليوز", "غشت", "شتنبر", "أكتوبر", "نونبر", "دجنبر"]

/** Stored calendar days (noon UTC, or midnight for older rows) that fall on the given day. */
function calendarDayRange(key: string): { gte: Date; lt: Date } {
  const start = new Date(`${key}T00:00:00.000Z`).getTime() - 2 * 3_600_000
  return { gte: new Date(start), lt: new Date(start + DAY) }
}

function trend(now: number, before: number): string {
  if (before <= 0) return now > 0 ? "لا توجد مبيعات للمقارنة في تلك الفترة" : "لا تغيير"
  const pct = Math.round(((now - before) / before) * 100)
  return pct === 0 ? "مماثل" : `${pct > 0 ? "⬆️ أعلى" : "⬇️ أقل"} بنسبة ${Math.abs(pct)}%`
}

async function revenue(window: DateWindow) {
  const rows = await getRevenueRows(window)
  const magazin = sum(rows.magazin), costumes = sum(rows.costumes), rentals = sum(rows.rentals)
  return { magazin, costumes, rentals, total: magazin + costumes + rentals }
}

interface SoldItem { name: string; quantity: number; amount: number }

/** What was sold in a window, both shops together, biggest quantity first. */
async function soldItems(window: DateWindow): Promise<SoldItem[]> {
  const range = { gte: window.from, lte: window.to }
  const [shop, costumes] = await Promise.all([
    prisma.saleItem.findMany({ where: { sale: { createdAt: range } }, select: { quantity: true, unitPrice: true, variant: { select: { product: { select: { name_ar: true } } } } } }),
    prisma.costumeSaleItem.findMany({ where: { sale: { createdAt: range } }, select: { quantity: true, unitPrice: true, costumeItem: { select: { name_ar: true, sku: true } } } }),
  ])
  const map = new Map<string, SoldItem>()
  const add = (name: string, quantity: number, price: number) => {
    const cur = map.get(name) ?? { name, quantity: 0, amount: 0 }
    cur.quantity += quantity; cur.amount += quantity * price
    map.set(name, cur)
  }
  for (const i of shop) add(i.variant.product.name_ar, i.quantity, toNum(i.unitPrice))
  for (const i of costumes) add([i.costumeItem.sku, i.costumeItem.name_ar].filter(Boolean).join(" "), i.quantity, toNum(i.unitPrice))
  return [...map.values()].sort((a, b) => b.quantity - a.quantity || b.amount - a.amount)
}

async function tillLines(): Promise<string[]> {
  const open = await prisma.caisseSession.findMany({ where: { closedAt: null }, select: { portal: true, openedAt: true } })
  return ([["magazin", "المتجر"], ["costumes", "البدلات"]] as const).map(([portal, label]) => {
    const s = open.find((x) => x.portal === portal)
    return `${s ? "🟢" : "🔴"} ${label}: ${s ? `مفتوح منذ ${formatDateTime(s.openedAt)}` : "مغلق"}`
  })
}

const rentalLine = (r: { client: { name: string; phone: string }; kit: { reference: string } | null; balance: unknown }) =>
  `• ${r.kit?.reference ?? "-"} | ${r.client.name} | ${r.client.phone}${toNum(r.balance as never) > 0 ? ` | المتبقي ${formatMAD(toNum(r.balance as never))}` : ""}`

const RENTAL_PICK = { client: { select: { name: true, phone: true } }, kit: { select: { reference: true } } } as const

// ── Morning brief ──────────────────────────────────────────────────────────────

export async function morningBrief(now: Date = new Date()): Promise<string> {
  const today = dayKey(now)
  const tomorrow = dayKey(new Date(now.getTime() + DAY))
  const inTwoDays = dayKey(new Date(now.getTime() + 2 * DAY))
  const WAITING = ["booked", "in_preparation", "ready_for_pickup"] as const

  const [pickups, returns, overdue, notReady, owing, tills, low] = await Promise.all([
    prisma.rental.findMany({ where: { status: { in: [...WAITING] }, scheduledPickupDate: calendarDayRange(today) }, include: RENTAL_PICK, orderBy: { createdAt: "asc" } }),
    prisma.rental.findMany({ where: { status: "picked_up", scheduledReturnDate: calendarDayRange(today) }, include: RENTAL_PICK, orderBy: { createdAt: "asc" } }),
    getOverdueRentals(),
    // handed over within two days, and nobody has started preparing the kit
    prisma.rental.findMany({ where: { status: "booked", scheduledPickupDate: { gte: calendarDayRange(today).gte, lt: calendarDayRange(inTwoDays).lt } }, include: RENTAL_PICK, orderBy: { scheduledPickupDate: "asc" } }),
    // leaves tomorrow and is not fully paid
    prisma.rental.findMany({ where: { status: { in: [...WAITING] }, balance: { gt: 0 }, scheduledPickupDate: calendarDayRange(tomorrow) }, include: RENTAL_PICK }),
    tillLines(),
    getLowStock(),
  ])

  const out: string[] = [`☀️ موجز الصباح | ${WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()]} ${formatDate(now)}`, ""]

  out.push(`👔 تسليم اليوم (${pickups.length})`)
  out.push(...(pickups.length ? pickups.map(rentalLine) : ["لا يوجد"]), "")
  out.push(`↩️ إرجاع اليوم (${returns.length})`)
  out.push(...(returns.length ? returns.map(rentalLine) : ["لا يوجد"]), "")

  if (overdue.length) {
    out.push(`⏰ إيجارات متأخرة (${overdue.length})`)
    out.push(...overdue.map((r) => `• ${r.reference} | ${r.clientName} | ${r.clientPhone} | كان الإرجاع ${formatDay(r.scheduledReturnDate)} | أيام التأخير: ${r.daysOverdue}`), "")
  }
  if (notReady.length) {
    out.push(`🧵 أطقم لم يبدأ تحضيرها (${notReady.length})`)
    out.push(...notReady.map((r) => `• ${r.kit?.reference ?? "-"} | ${r.client.name} | التسليم ${formatDay(r.scheduledPickupDate)}`), "")
  }
  if (owing.length) {
    out.push(`💰 تسليم غدا مع مبلغ غير مدفوع (${owing.length})`)
    out.push(...owing.map(rentalLine), "")
  }

  out.push("الصناديق", ...tills, "")
  out.push(`📦 مخزون منخفض: ${low.length}`)
  if (low.length) {
    out.push(...low.slice(0, 10).map((e) => `• ${lowStockLabel(e)} | ${e.stock <= 0 ? "نفد" : `المتبقي ${e.stock}`}`))
    if (low.length > 10) out.push(`وعناصر أخرى: ${low.length - 10}. اكتب /stock لرؤية القائمة كاملة`)
  }
  return out.join("\n").trim()
}

// ── Evening report (also the answer to /today) ─────────────────────────────────

export async function dayReport(now: Date = new Date(), title = "🌙 تقرير نهاية اليوم"): Promise<string> {
  const from = lastDailyCutoff(AUTO_CLOSE_HOUR, now)
  const window: DateWindow = { from, to: now }
  const lastWeek: DateWindow = { from: new Date(from.getTime() - 7 * DAY), to: new Date(now.getTime() - 7 * DAY) }
  const range = { gte: from, lte: now }
  const today = dayKey(now)

  const [rev, revBefore, shopSales, costumeSales, deposits, expenses, items] = await Promise.all([
    revenue(window),
    revenue(lastWeek),
    prisma.sale.findMany({ where: { createdAt: range }, select: { totalAmount: true, paymentMethod: true } }),
    prisma.costumeSale.findMany({ where: { createdAt: range }, select: { totalAmount: true, paymentMethod: true } }),
    prisma.rentalPayment.findMany({ where: { createdAt: range, type: { in: ["deposit_collected", "deposit_returned"] } }, select: { amount: true, type: true } }),
    prisma.expense.findMany({ where: { date: { gte: startOfDay(today), lte: endOfDay(today) } }, select: { amount: true, description: true } }),
    soldItems(window),
  ])

  const shopBlock = (label: string, sales: { totalAmount: unknown; paymentMethod: string }[]) => {
    const total = sales.reduce((s, x) => s + toNum(x.totalAmount as never), 0)
    const lines = [`${label}: ${formatMAD(total)} | عدد العمليات: ${count(sales.length)}`]
    if (sales.length) {
      const byMethod = new Map<string, number>()
      for (const s of sales) byMethod.set(s.paymentMethod, (byMethod.get(s.paymentMethod) ?? 0) + toNum(s.totalAmount as never))
      lines.push("   " + [...byMethod].map(([m, v]) => `${paymentMethodLabel(m)} ${formatMAD(v)}`).join(" | "))
      lines.push(`   متوسط السلة: ${formatMAD(total / sales.length)}`)
    }
    return lines
  }
  const depositsIn  = deposits.filter((d) => d.type === "deposit_collected").reduce((s, d) => s + toNum(d.amount), 0)
  const depositsOut = deposits.filter((d) => d.type === "deposit_returned").reduce((s, d) => s + toNum(d.amount), 0)
  const spent = expenses.reduce((s, e) => s + toNum(e.amount), 0)

  const out: string[] = [`${title} | ${formatDate(now)}`, `من ${formatDateTime(from)} إلى ${formatDateTime(now)}`, ""]
  out.push("🧾 المبيعات", ...shopBlock("المتجر", shopSales), ...shopBlock("البدلات", costumeSales), "")
  out.push(`👔 إيرادات الإيجار: ${formatMAD(rev.rentals)}`)
  if (depositsIn || depositsOut) out.push(`   ضمانات مستلمة ${formatMAD(depositsIn)} | ضمانات مُرجعة ${formatMAD(depositsOut)}`)
  out.push("")
  out.push(`💵 مجموع ما دخل اليوم: ${formatMAD(rev.total)}`)
  out.push(`   مقارنة بنفس اليوم من الأسبوع الماضي (${formatMAD(revBefore.total)}): ${trend(rev.total, revBefore.total)}`)
  out.push(`🧮 مصروفات اليوم: ${formatMAD(spent)}`)
  out.push(`📈 الصافي: ${formatSignedMAD(rev.total - spent, { plus: false })}`, "")
  if (items.length) out.push(`🏆 الأكثر مبيعا: ${items[0].name} | الكمية: ${items[0].quantity}`, "")
  out.push("الصناديق", ...(await tillLines()))
  return out.join("\n").trim()
}

// ── Weekly summary ─────────────────────────────────────────────────────────────

export async function weeklyReport(now: Date = new Date()): Promise<string> {
  const week: DateWindow = { from: new Date(now.getTime() - 7 * DAY), to: now }
  const before: DateWindow = { from: new Date(now.getTime() - 14 * DAY), to: week.from }
  const monthAgo = new Date(now.getTime() - 30 * DAY)

  const [rev, revBefore, items, expenses, oldDebts, sleeping] = await Promise.all([
    revenue(week),
    revenue(before),
    soldItems(week),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: week.from, lte: now } } }),
    prisma.credit.findMany({ where: { status: { not: "settled" }, createdAt: { lt: monthAgo } }, select: { clientName: true, clientPhone: true, balance: true, createdAt: true }, orderBy: { balance: "desc" }, take: 10 }),
    // in stock for more than 30 days and not sold once in the last 30 days
    prisma.product.findMany({
      where:  { isActive: true, createdAt: { lt: monthAgo }, variants: { some: { stock: { gt: 0 } }, none: { saleItems: { some: { sale: { createdAt: { gte: monthAgo } } } } } } },
      select: { name_ar: true, variants: { select: { stock: true } } },
      take:   10,
    }),
  ])
  const spent = toNum(expenses._sum.amount)

  const out: string[] = [`🗓️ ملخص الأسبوع | من ${formatDate(week.from)} إلى ${formatDate(now)}`, ""]
  out.push(`المتجر: ${formatMAD(rev.magazin)}`, `البدلات (بيع): ${formatMAD(rev.costumes)}`, `الإيجار: ${formatMAD(rev.rentals)}`)
  out.push(`💵 المجموع: ${formatMAD(rev.total)} | الأسبوع السابق ${formatMAD(revBefore.total)} | ${trend(rev.total, revBefore.total)}`)
  out.push(`🧮 المصروفات: ${formatMAD(spent)} | 📈 الصافي: ${formatSignedMAD(rev.total - spent, { plus: false })}`, "")

  out.push("🏆 الأكثر مبيعا")
  out.push(...(items.length ? items.slice(0, 5).map((i, n) => `${n + 1}. ${i.name} | الكمية: ${i.quantity} | ${formatMAD(i.amount)}`) : ["لا توجد مبيعات هذا الأسبوع"]), "")

  if (sleeping.length) {
    out.push("🛌 منتجات لم تُبع منذ 30 يوما")
    out.push(...sleeping.map((p) => `• ${p.name_ar} | في المخزون ${p.variants.reduce((s, v) => s + v.stock, 0)}`), "")
  }
  if (oldDebts.length) {
    out.push("⏳ ديون قديمة (أكثر من 30 يوما)")
    out.push(...oldDebts.map((d) => `• ${d.clientName}${d.clientPhone ? ` | ${d.clientPhone}` : ""} | ${formatMAD(toNum(d.balance))} | منذ ${formatDate(d.createdAt)}`))
  }
  return out.join("\n").trim()
}

// ── Monthly summary (previous calendar month) ──────────────────────────────────

export async function monthlyReport(now: Date = new Date()): Promise<{ text: string; table: TableSpec }> {
  const c = businessClock(now)
  const year = c.month === 1 ? c.year - 1 : c.year
  const month = c.month === 1 ? 12 : c.month - 1
  const pad = (n: number) => String(n).padStart(2, "0")
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const window: DateWindow = { from: startOfDay(`${year}-${pad(month)}-01`), to: endOfDay(`${year}-${pad(month)}-${pad(lastDay)}`) }

  const [rev, expenses, items] = await Promise.all([
    revenue(window),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: window.from, lte: window.to } } }),
    soldItems(window),
  ])
  const spent = toNum(expenses._sum.amount)
  const title = `حصيلة شهر ${MONTHS[month - 1]} ${year}`
  const rows: [string, number][] = [["مبيعات المتجر", rev.magazin], ["مبيعات البدلات", rev.costumes], ["إيرادات الإيجار", rev.rentals], ["مجموع الإيرادات", rev.total], ["المصروفات", -spent], ["الصافي", rev.total - spent]]

  return {
    text: [`📅 ${title}`, "", ...rows.map(([label, v]) => `${label}: ${formatMAD(v)}`), "", ...(items.length ? ["🏆 الأكثر مبيعا", ...items.slice(0, 5).map((i, n) => `${n + 1}. ${i.name} | الكمية: ${i.quantity}`)] : [])].join("\n").trim(),
    table: { title, columns: [{ header: "البند", width: 300 }, { header: "المبلغ (درهم)", width: 240 }], rows: rows.map(([label, v]) => [label, formatNumber(v)]) },
  }
}

// ── Short answers for bot commands ─────────────────────────────────────────────

export async function tillStatus(): Promise<string> {
  return ["الصناديق", ...(await tillLines())].join("\n")
}

export async function debtsReport(): Promise<string> {
  const debts = await prisma.credit.findMany({ where: { status: { not: "settled" } }, select: { clientName: true, clientPhone: true, balance: true, createdAt: true }, orderBy: { balance: "desc" } })
  if (!debts.length) return "✅ لا توجد ديون غير مسددة"
  const total = debts.reduce((s, d) => s + toNum(d.balance), 0)
  return [`💳 الديون غير المسددة (${debts.length}) | المجموع ${formatMAD(total)}`, "", ...debts.slice(0, 25).map((d) => `• ${d.clientName}${d.clientPhone ? ` | ${d.clientPhone}` : ""} | ${formatMAD(toNum(d.balance))} | منذ ${formatDate(d.createdAt)}`)].join("\n")
}

export async function rentalsReport(): Promise<string> {
  const active = await prisma.rental.findMany({
    where:   { status: { in: ["booked", "in_preparation", "ready_for_pickup", "picked_up"] } },
    include: RENTAL_PICK,
    orderBy: { scheduledPickupDate: "asc" },
  })
  if (!active.length) return "لا توجد إيجارات جارية"
  const today = todayKey()
  const label: Record<string, string> = { booked: "محجوز", in_preparation: "قيد التحضير", ready_for_pickup: "جاهز للاستلام", picked_up: "لدى العميل" }
  return [`👔 الإيجارات الجارية (${active.length}) | اليوم ${formatDay(`${today}T12:00:00Z`)}`, "",
    ...active.slice(0, 30).map((r) => `• ${r.kit?.reference ?? "-"} | ${r.client.name} | ${label[r.status] ?? r.status} | ${formatDay(r.scheduledPickupDate)} إلى ${formatDay(r.scheduledReturnDate)}${toNum(r.balance) > 0 ? ` | المتبقي ${formatMAD(toNum(r.balance))}` : ""}`)].join("\n")
}
