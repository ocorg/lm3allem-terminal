import { createHash, timingSafeEqual } from "node:crypto"
import { getLowStock } from "@/lib/inventory/low-stock"
import { sendLowStockReport } from "@/lib/notifications/low-stock-report"
import { isTableRenderingAvailable, renderTablePng } from "@/lib/notifications/table-image"
import { sendTelegram, sendTelegramPhoto } from "@/lib/notifications/telegram"
import { dayReport, debtsReport, monthlyReport, morningBrief, rentalsReport, tillStatus, weeklyReport } from "@/lib/reports/reports"

/**
 * "Ask the bot": commands typed in the owners' Telegram group.
 *
 * Safety:
 *   - Telegram proves each call with a secret header (derived from the bot token, so there is
 *     nothing extra to configure and nobody else can call the address);
 *   - only messages written in the configured group are answered, and the answer always goes to
 *     that same group. A stranger who finds the bot gets silence.
 *   - commands only READ data. Nothing can be changed from Telegram.
 */

export function webhookSecret(): string {
  return createHash("sha256").update(`lm3allem-webhook:${process.env.TELEGRAM_BOT_TOKEN ?? ""}`).digest("hex")
}

export function isTelegramCall(headerValue: string | null): boolean {
  if (!process.env.TELEGRAM_BOT_TOKEN || !headerValue) return false
  const given = Buffer.from(headerValue), expected = Buffer.from(webhookSecret())
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export const BOT_COMMANDS: { command: string; description: string }[] = [
  { command: "today",   description: "مبيعات ومداخيل اليوم حتى الآن" },
  { command: "morning", description: "موجز الصباح: التسليم والإرجاع والتذكيرات" },
  { command: "caisse",  description: "حالة الصناديق" },
  { command: "stock",   description: "المنتجات منخفضة المخزون" },
  { command: "rentals", description: "الإيجارات الجارية" },
  { command: "debts",   description: "الديون غير المسددة" },
  { command: "week",    description: "ملخص آخر سبعة أيام" },
  { command: "month",   description: "حصيلة الشهر الماضي" },
  { command: "help",    description: "قائمة الأوامر" },
]

const HELP = ["🤖 أوامر مساعد لمعلم", "", ...BOT_COMMANDS.map((c) => `/${c.command} | ${c.description}`)].join("\n")

interface TelegramUpdate { message?: { text?: string; chat?: { id?: number | string } } }

/** Answers one update. Never throws: Telegram retries a failed call again and again. */
export async function handleBotUpdate(update: TelegramUpdate): Promise<void> {
  const text = update.message?.text?.trim() ?? ""
  const chatId = String(update.message?.chat?.id ?? "")
  if (!text.startsWith("/") || !chatId || chatId !== String(process.env.TELEGRAM_CHAT_ID ?? "")) return

  // "/today@MyBot extra words" -> "today"
  const command = text.slice(1).split(/[\s@]/)[0].toLowerCase()
  try {
    switch (command) {
      case "today":   await sendTelegram(await dayReport(new Date(), "📊 حالة اليوم حتى الآن")); break
      case "morning": await sendTelegram(await morningBrief()); break
      case "caisse":  await sendTelegram(await tillStatus()); break
      case "rentals": await sendTelegram(await rentalsReport()); break
      case "debts":   await sendTelegram(await debtsReport()); break
      case "week":    await sendTelegram(await weeklyReport()); break
      case "stock": {
        const low = await getLowStock()
        if (low.length === 0) await sendTelegram("✅ لا يوجد مخزون منخفض")
        else await sendLowStockReport(low)
        break
      }
      case "month": {
        const month = await monthlyReport()
        let pictured = false
        if (isTableRenderingAvailable()) {
          try { pictured = await sendTelegramPhoto(await renderTablePng(month.table), month.table.title) } catch { pictured = false }
        }
        if (!pictured) await sendTelegram(month.text)
        break
      }
      case "start":
      case "help":    await sendTelegram(HELP); break
      default:        return // not one of ours: stay quiet
    }
  } catch (err) {
    console.error("[bot]", command, err instanceof Error ? err.message : err)
    await sendTelegram("تعذر تحضير الجواب الآن. أعد المحاولة بعد لحظات.")
  }
}
