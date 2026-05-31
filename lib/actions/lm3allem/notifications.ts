"use server"

import { auth }   from "@/lib/auth/auth"
import { prisma } from "@/lib/db/prisma"
import { Prisma } from "@prisma/client"

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
    // P2021 = table does not exist (migration pending)
    // Return empty array so the bell renders silently until DB is migrated.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2021"
    ) {
      return []
    }
    throw err
  }
}

// ── markAsRead ─────────────────────────────────────────────────
export async function markAsRead(id: string): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  try {
    await prisma.notification.update({
      where: { id },
      data:  { isRead: true },
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2021"
    ) return
    throw err
  }
}

// ── markAllRead ────────────────────────────────────────────────
export async function markAllRead(): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  try {
    await prisma.notification.updateMany({
      where: { isRead: false },
      data:  { isRead: true },
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2021"
    ) return
    throw err
  }
}
