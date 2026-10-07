import { after, NextRequest, NextResponse } from "next/server"
import { handleBotUpdate, isTelegramCall } from "@/lib/notifications/bot"

/**
 * Telegram calls this address when someone writes a command in the owners' group.
 * See lib/notifications/bot.ts for the safety rules.
 */
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!isTelegramCall(req.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const update = await req.json().catch(() => null)
  // Answer Telegram at once (it resends anything slower than a few seconds), then do the work.
  if (update) after(() => handleBotUpdate(update))
  return NextResponse.json({ ok: true })
}
