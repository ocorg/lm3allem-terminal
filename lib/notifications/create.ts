import { prisma }          from "@/lib/db/prisma"
import { getPusherServer } from "@/lib/pusher/server"
import type { Role }       from "@prisma/client"
import { sendTelegram }    from "@/lib/notifications/telegram"
import { defer }           from "@/lib/utils/defer"

export type NotificationType = "rental" | "caisse_open" | "caisse_close" | "low_stock"

export interface NotificationInput {
  title:  string
  body:   string
  type:   NotificationType
  portal: string
  /** When the triggering user is the ghost account, no notification is created. */
  actor?: { role: Role | string }
  /** set false to keep it in the in-app bell only (e.g. when a summary is sent separately) */
  telegram?: boolean
}

const PORTAL_LABEL: Record<string, string> = { magazin: "المتجر", costumes: "البدلات", lm3allem: "الإدارة" }
const TYPE_ICON: Record<string, string> = { rental: "👔", caisse_open: "🟢", caisse_close: "🔴", low_stock: "⚠️" }

/** Best-effort: never throws, so it can be awaited after a committed business operation. */
export async function createNotification(input: NotificationInput): Promise<void> {
  if (input.actor?.role === "ghost") return
  await defer(() => deliver(input))
}

async function deliver(input: NotificationInput): Promise<void> {
  try {
    const notification = await prisma.notification.create({
      data: { title: input.title, body: input.body, type: input.type, portal: input.portal },
    })

    // Telegram copy (best effort, never blocks or fails the operation that triggered it)
    if (input.telegram !== false) {
      await sendTelegram(
        `${TYPE_ICON[input.type] ?? "🔔"} ${input.title}
${input.body}
| ${PORTAL_LABEL[input.portal] ?? input.portal}`
      )
    }

    try {
      await getPusherServer().trigger(
        "private-lm3allem-notifications",
        "notification:new",
        {
          id:        notification.id,
          title:     notification.title,
          body:      notification.body,
          type:      notification.type,
          portal:    notification.portal,
          isRead:    false,
          createdAt: notification.createdAt.toISOString(),
        }
      )
    } catch {
      // Pusher failure is non-critical - notification already saved to DB
    }
  } catch (err) {
    console.error("[notifications] failed to create notification:", err)
  }
}
