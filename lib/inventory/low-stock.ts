import { prisma } from "@/lib/db/prisma"

/** Items at or below this quantity are reported as low stock. */
export const LOW_STOCK_THRESHOLD = 2

type Named = { label_ar: string } | null | undefined

const SEP = " | "
const dash = (v: string | null | undefined) => (v && v.trim() ? v : "-")

/** "42 | أسود" - which size/colour of a retail product (used inside one-line labels). */
export function variantDetail(v: { size?: Named; color?: Named }): string {
  return [v.size?.label_ar, v.color?.label_ar].filter(Boolean).join(SEP)
}

/** "ART-0003 | بدلة 48 | سروال 44 | قميص 40 | حذاء 42" - which costume item (one-line label). */
export function costumeDetail(i: {
  sku?: string | null
  size?: Named
  pantsSize?: Named
  shirtSize?: Named
  shoeSize?: Named
}): string {
  return [
    i.sku,
    i.size ? `بدلة ${i.size.label_ar}` : null,
    i.pantsSize ? `سروال ${i.pantsSize.label_ar}` : null,
    i.shirtSize ? `قميص ${i.shirtSize.label_ar}` : null,
    i.shoeSize ? `حذاء ${i.shoeSize.label_ar}` : null,
  ].filter(Boolean).join(SEP)
}

export interface LowStockEntry {
  id:     string
  portal: "magazin" | "costumes"
  name:   string
  /** short description for one-line displays ("42 | أسود") */
  detail: string
  stock:  number
  /** the table cells between the name and the quantity, in column order */
  cells:  string[]
  /** costumes only: item code */
  sku?:   string | null
}

/** Every low-stock retail variant and costume item, with enough detail to know what to reorder. */
export async function getLowStock(limit?: number): Promise<LowStockEntry[]> {
  const [variants, costumes] = await Promise.all([
    prisma.productVariant.findMany({
      where:   { stock: { lte: LOW_STOCK_THRESHOLD }, product: { isActive: true } },
      include: {
        product: { select: { name_ar: true } },
        size:    { select: { label_ar: true } },
        color:   { select: { label_ar: true } },
      },
      orderBy: [{ stock: "asc" }],
      take:    limit,
    }),
    prisma.costumeItem.findMany({
      where:   { stock: { lte: LOW_STOCK_THRESHOLD }, isActive: true },
      include: {
        size:      { select: { label_ar: true } },
        pantsSize: { select: { label_ar: true } },
        shirtSize: { select: { label_ar: true } },
        shoeSize:  { select: { label_ar: true } },
      },
      orderBy: [{ stock: "asc" }],
      take:    limit,
    }),
  ])

  return [
    ...variants.map((v) => ({
      id: v.id, portal: "magazin" as const, name: v.product.name_ar,
      detail: variantDetail(v), stock: v.stock,
      cells: [dash(v.size?.label_ar), dash(v.color?.label_ar)],
    })),
    ...costumes.map((c) => ({
      id: c.id, portal: "costumes" as const, name: c.name_ar, sku: c.sku,
      detail: costumeDetail(c), stock: c.stock,
      cells: [
        dash(c.size?.label_ar), dash(c.pantsSize?.label_ar),
        dash(c.shirtSize?.label_ar), dash(c.shoeSize?.label_ar),
      ],
    })),
  ]
}

export const stockText = (n: number) => (n <= 0 ? "نفد" : String(n))

/** One-line label for lists: "حذاء | 42 | أسود". */
export function lowStockLabel(e: LowStockEntry): string {
  return e.detail ? `${e.name}${SEP}${e.detail}` : e.name
}

const row = (cells: string[]) => cells.join(SEP)

/**
 * Telegram text: one small table per shop (header row, then one row per item), out-of-stock first.
 * Plain text with "|" between columns, because Telegram cannot draw real tables.
 */
export function formatLowStockMessage(entries: LowStockEntry[]): string {
  const sorted = (portal: "magazin" | "costumes") =>
    entries
      .filter((e) => e.portal === portal)
      .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, "ar"))

  const magazin = sorted("magazin")
  const costumes = sorted("costumes")

  const lines: string[] = [
    `⚠️ مخزون منخفض (${entries.length})`,
    "",
  ]

  if (magazin.length) {
    lines.push(
      `🛍 المتجر (${magazin.length})`,
      row(["المنتج", "المقاس", "اللون", "الكمية"]),
      ...magazin.map((e) => row([e.name, ...e.cells, stockText(e.stock)])),
      ""
    )
  }

  if (costumes.length) {
    lines.push(
      `👔 البدلات (${costumes.length})`,
      row(["الرمز", "النوع", "بدلة", "سروال", "قميص", "حذاء", "الكمية"]),
      ...costumes.map((e) => row([dash(e.sku), e.name, ...e.cells, stockText(e.stock)])),
      ""
    )
  }

  return lines.join("\n").trim()
}

// ── Table (picture) version for Telegram ────────────────────────────

import type { TableSpec } from "@/lib/notifications/table-image"

const ROWS_PER_IMAGE = 28

/** One or more table specs (a long list is split over several pictures). */
export function lowStockTables(entries: LowStockEntry[]): TableSpec[] {
  const sorted = (portal: "magazin" | "costumes") =>
    entries
      .filter((e) => e.portal === portal)
      .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, "ar"))

  const specs: TableSpec[] = []

  const add = (title: string, columns: TableSpec["columns"], rows: string[][]) => {
    const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_IMAGE))
    for (let p = 0; p < pages; p++) {
      specs.push({
        title: pages > 1 ? `${title} (${p + 1}/${pages})` : title,
        columns,
        rows: rows.slice(p * ROWS_PER_IMAGE, (p + 1) * ROWS_PER_IMAGE),
        alertText: "نفد",
      })
    }
  }

  const magazin = sorted("magazin")
  if (magazin.length) {
    add(
      `مخزون منخفض | المتجر (${magazin.length})`,
      [{ header: "المنتج", width: 330 }, { header: "المقاس", width: 130 }, { header: "اللون", width: 150 }, { header: "الكمية", width: 110 }],
      magazin.map((e) => [e.name, ...e.cells, stockText(e.stock)])
    )
  }

  const costumes = sorted("costumes")
  if (costumes.length) {
    add(
      `مخزون منخفض | البدلات (${costumes.length})`,
      [
        { header: "الرمز", width: 130 }, { header: "النوع", width: 250 },
        { header: "بدلة", width: 90 }, { header: "سروال", width: 90 },
        { header: "قميص", width: 90 }, { header: "حذاء", width: 90 }, { header: "الكمية", width: 100 },
      ],
      costumes.map((e) => [dash(e.sku), e.name, ...e.cells, stockText(e.stock)])
    )
  }

  return specs
}
