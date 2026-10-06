/**
 * Telegram alerts (replaces e-mail).
 *
 * Needs TELEGRAM_BOT_TOKEN (from @BotFather) and TELEGRAM_CHAT_ID (the chat/group that receives
 * the alerts). Without them nothing is sent and nothing fails: the in-app bell keeps working.
 *
 * Messages are plain text (no markup parsing), so customer names can never break the message.
 */

export function isTelegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID
}

const MAX_LEN = 3800 // Telegram refuses messages above 4096 characters

/** Splits a long text on line breaks so nothing is cut off. */
function chunk(text: string): string[] {
  if (text.length <= MAX_LEN) return [text]
  const parts: string[] = []
  let current = ""
  for (const line of text.split("\n")) {
    if (current && current.length + line.length + 1 > MAX_LEN) { parts.push(current); current = "" }
    current += (current ? "\n" : "") + line.slice(0, MAX_LEN)
  }
  if (current) parts.push(current)
  return parts
}

/** Best-effort: returns true when Telegram accepted EVERY part, never throws. */
export async function sendTelegram(text: string): Promise<boolean> {
  let allSent = true
  for (const part of chunk(text)) {
    if (!(await sendOne(part))) allSent = false
  }
  return allSent
}

/** Sends a PNG picture (used for tables). Best-effort, never throws. */
export async function sendTelegramPhoto(png: Buffer, caption?: string): Promise<boolean> {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false

  try {
    const form = new FormData()
    form.append("chat_id", chatId)
    if (caption) form.append("caption", caption.slice(0, 1000))
    form.append("photo", new Blob([new Uint8Array(png)], { type: "image/png" }), "table.png")

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body:   form,
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) {
      console.error("[telegram] photo failed:", res.status, await res.text().catch(() => ""))
      return false
    }
    return true
  } catch (err) {
    console.error("[telegram] photo error:", err instanceof Error ? err.message : err)
    return false
  }
}

async function sendOne(text: string): Promise<boolean> {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) {
      // never log the token: only the status and Telegram's own explanation
      console.error("[telegram] send failed:", res.status, await res.text().catch(() => ""))
      return false
    }
    return true
  } catch (err) {
    console.error("[telegram] send error:", err instanceof Error ? err.message : err)
    return false
  }
}
