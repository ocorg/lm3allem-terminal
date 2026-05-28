"use server"

import { auth }   from "@/lib/auth/auth"
import { prisma } from "@/lib/db/prisma"

export interface SerializedNotification {
  id:        string
  title:     string
  body:      string
  type:      string
  portal:    string
  isRead:    boolean
  createdAt: string
}

// ── getNotifications ───────────────────────────────────────────
export async function getNotifications(): Promise<SerializedNotification[]> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

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
}

// ── markAsRead ─────────────────────────────────────────────────
export async function markAsRead(id: string): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  await prisma.notification.update({
    where: { id },
    data:  { isRead: true },
  })
}

// ── markAllRead ────────────────────────────────────────────────
export async function markAllRead(): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  await prisma.notification.updateMany({
    where: { isRead: false },
    data:  { isRead: true },
  })
}