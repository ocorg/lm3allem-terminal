import { prisma }          from "@/lib/db/prisma"
import { getPusherServer } from "@/lib/pusher/server"

export type NotificationType = "rental" | "caisse_open" | "caisse_close" | "low_stock"

export interface NotificationInput {
  title:  string
  body:   string
  type:   NotificationType
  portal: string
}

export async function createNotification(input: NotificationInput): Promise<void> {
  const notification = await prisma.notification.create({ data: input })

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
}