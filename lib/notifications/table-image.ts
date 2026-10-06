import path from "node:path"
import { existsSync } from "node:fs"
import sharp from "sharp"

/**
 * Draws a real table as a PNG image (Telegram has no table support, but it shows images perfectly).
 * Arabic is shaped and laid out right-to-left by sharp's text engine using the bundled Cairo font
 * (assets/fonts/Cairo.ttf), so the result does not depend on fonts installed on the server.
 *
 * Columns are listed in READING order: the first column is drawn at the right edge.
 */

export interface TableColumn {
  header: string
  width:  number
}

export interface TableSpec {
  title:    string
  columns:  TableColumn[]
  rows:     string[][]
  /** cells with this exact text are drawn in red (e.g. "نفد") */
  alertText?: string
}

const FONT_FILE = path.join(process.cwd(), "assets", "fonts", "Cairo.ttf")
const FONT = "Cairo 11"
const DPI = 144

const ROW_H = 46
const HEAD_H = 52
const TITLE_H = 70
const PAD = 22

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export function isTableRenderingAvailable(): boolean {
  return existsSync(FONT_FILE)
}

async function text(value: string, width: number, color: string, bold = false, size?: string): Promise<{ input: Buffer; width: number; height: number }> {
  const sizeAttr = size ? ` size="${size}"` : ""
  const markup = `<span foreground="${color}"${sizeAttr}>${bold ? "<b>" : ""}${esc(value)}${bold ? "</b>" : ""}</span>`
  const input = await sharp({
    text: { text: markup, font: FONT, fontfile: FONT_FILE, rgba: true, width, align: "centre", dpi: DPI, wrap: "word-char" },
  }).png().toBuffer()
  const meta = await sharp(input).metadata()
  return { input, width: meta.width ?? width, height: meta.height ?? 0 }
}

function rect(width: number, height: number, color: string): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: color } }).png().toBuffer()
}

export async function renderTablePng(spec: TableSpec): Promise<Buffer> {
  const tableW = spec.columns.reduce((s, c) => s + c.width, 0)
  const width = tableW + PAD * 2
  const height = TITLE_H + HEAD_H + spec.rows.length * ROW_H + PAD

  const layers: sharp.OverlayOptions[] = []

  // Title (right-aligned block spanning the table width)
  const title = await text(spec.title, tableW, "#111827", true, "x-large")
  // Arabic reads right to left: the title sits at the RIGHT edge of the table
  layers.push({ input: title.input, left: PAD + tableW - title.width, top: Math.round((TITLE_H - title.height) / 2) })

  // Header band
  layers.push({ input: await rect(tableW, HEAD_H, "#1f2937"), left: PAD, top: TITLE_H })

  // Columns are laid out from the RIGHT edge towards the left
  const colLeft: number[] = []
  let cursor = PAD + tableW
  for (const col of spec.columns) {
    cursor -= col.width
    colLeft.push(cursor)
  }

  // First column: right-aligned (names read from the right). Other columns: centred.
  const placeX = (c: number, w: number) =>
    c === 0
      ? colLeft[c] + spec.columns[c].width - 8 - w
      : colLeft[c] + Math.round((spec.columns[c].width - w) / 2)

  for (let c = 0; c < spec.columns.length; c++) {
    const h = await text(spec.columns[c].header, spec.columns[c].width - 16, "#ffffff", true)
    layers.push({ input: h.input, left: placeX(c, h.width), top: TITLE_H + Math.round((HEAD_H - h.height) / 2) })
  }

  // Body rows (zebra stripes keep long tables readable)
  for (let r = 0; r < spec.rows.length; r++) {
    const top = TITLE_H + HEAD_H + r * ROW_H
    layers.push({ input: await rect(tableW, ROW_H, r % 2 === 0 ? "#f3f4f6" : "#ffffff"), left: PAD, top })
    for (let c = 0; c < spec.columns.length; c++) {
      const value = spec.rows[r][c] ?? "-"
      const alert = spec.alertText !== undefined && value === spec.alertText
      const cell = await text(value, spec.columns[c].width - 16, alert ? "#dc2626" : "#111827", alert)
      layers.push({ input: cell.input, left: placeX(c, cell.width), top: top + Math.round((ROW_H - cell.height) / 2) })
    }
  }

  return sharp({ create: { width, height, channels: 4, background: "#ffffff" } })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toBuffer()
}
