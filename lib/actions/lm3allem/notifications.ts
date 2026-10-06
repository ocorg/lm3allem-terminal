"use server"

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { requireAdmin } from "@/lib/auth/guard"
import { asId } from "@/lib/validation"

export interface SerializedNotification {
  id:        string
  title:     string
  body:      string
  type:      string
  portal:    string
  isRead:    boolean
  createdAt: string
}

function isMissingTable(err: unknown): boolean {
  // P2021 = table does not exist (migration pending): render an empty bell instead of crashing
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021"
}

// ── getNotifications ───────────────────────────────────────────
export async function getNotifications(): Promise<SerializedNotification[]> {
  await requireAdmin()

  try {
    const rows = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take:    50,
    })

    return rows.map(n => ({
      id:        n.id,
      title:     n.title,
      body:      n.body,
      type:      n.type,
      portal:    n.portal,
      isRead:    n.isRead,
      createdAt: n.createdAt.toISOString(),
    }))
  } catch (err) {
    if (isMissingTable(err)) return []
    throw err
  }
}

// ── markAsRead ─────────────────────────────────────────────────
export async function markAsRead(notificationId: string): Promise<void> {
  notificationId = asId(notificationId)
  await requireAdmin()

  try {
    await prisma.notification.updateMany({ where: { id: notificationId }, data: { isRead: true } })
  } catch (err) {
    if (!isMissingTable(err)) throw err
  }
}

// ── markAllRead ────────────────────────────────────────────────
export async function markAllRead(): Promise<void> {
  await requireAdmin()

  try {
    await prisma.notification.updateMany({ where: { isRead: false }, data: { isRead: true } })
  } catch (err) {
    if (!isMissingTable(err)) throw err
  }
}
