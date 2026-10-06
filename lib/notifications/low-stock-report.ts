import { formatLowStockMessage, lowStockTables, type LowStockEntry } from "@/lib/inventory/low-stock"
import { isTableRenderingAvailable, renderTablePng } from "@/lib/notifications/table-image"
import { sendTelegram, sendTelegramPhoto } from "@/lib/notifications/telegram"

/**
 * Sends the low-stock list to Telegram as real table PICTURES (one per shop, split if long).
 * If a picture cannot be produced or sent, the same data is sent as a text table instead,
 * so the alert is never lost.
 */
export async function sendLowStockReport(entries: LowStockEntry[]): Promise<boolean> {
  if (entries.length === 0) return false

  if (isTableRenderingAvailable()) {
    try {
      const specs = lowStockTables(entries)
      let sentAny = false
      for (let i = 0; i < specs.length; i++) {
        const png = await renderTablePng(specs[i])
        const ok = await sendTelegramPhoto(png, i === 0 ? `⚠️ مخزون منخفض (${entries.length})` : undefined)
        if (ok) sentAny = true
        else if (!sentAny) break // the very first picture failed: use the text version below
      }
      if (sentAny) return true
    } catch (err) {
      console.error("[low-stock] table image failed, falling back to text:", err instanceof Error ? err.message : err)
    }
  }

  return sendTelegram(formatLowStockMessage(entries))
}
