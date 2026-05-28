"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/prisma"
import { hashPin } from "@/lib/auth/pin"
import { logActivity }      from "@/lib/activity/logger"
import { sendMail }          from "@/lib/email/mailer"
import { pinDeliveryHtml }   from "@/lib/email/templates"

function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export interface SerializedUser {
  id: string
  name: string
  role: string
  portalAccess: string[]
  modulePermissions: Record<string, unknown>
  isActive: boolean
  preferredLanguage: string
  preferredTheme: string
}

export async function getUsers(): Promise<SerializedUser[]> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      portalAccess: true,
      modulePermissions: true,
      isActive: true,
      preferredLanguage: true,
      preferredTheme: true,
    },
  })

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    portalAccess: u.portalAccess as string[],
    modulePermissions: (u.modulePermissions ?? {}) as Record<string, unknown>,
    isActive: u.isActive,
    preferredLanguage: (u.preferredLanguage as string) ?? "fr",
    preferredTheme: (u.preferredTheme as string) ?? "dark",
  }))
}

export interface CreateUserInput {
  name: string
  role: "admin" | "staff"
  portalAccess: string[]
  modulePermissions: Record<string, unknown>
}

export async function createUser(
  input: CreateUserInput
): Promise<{ user: SerializedUser; plainPin: string }> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const plainPin = generatePin()
  const hashedPin = await hashPin(plainPin)

  const user = await prisma.user.create({
    data: {
      name: input.name,
      role: input.role as any,
      portalAccess: input.portalAccess as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      modulePermissions: input.modulePermissions as any,
      pin: hashedPin,
      isActive: true,
      preferredLanguage: "fr" as any,
      preferredTheme: "dark" as any,
    },
    select: {
      id: true,
      name: true,
      role: true,
      portalAccess: true,
      modulePermissions: true,
      isActive: true,
      preferredLanguage: true,
      preferredTheme: true,
    },
  })

  await logActivity({
    portal: "lm3allem",
    entityType: "user",
    entityId: user.id,
    actorId: session.user.id,
    action: "user.created",
    diff: { name: input.name, role: input.role },
  })

  // Email — PIN delivery to admin (non-blocking)
  try {
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      await sendMail(
        adminEmail,
        `Nouveau compte — ${input.name}`,
        pinDeliveryHtml({ userName: input.name, pin: plainPin, action: "created" })
      )
    }
  } catch {
    // Email failure must never break user creation
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      portalAccess: user.portalAccess as string[],
      modulePermissions: (user.modulePermissions ?? {}) as Record<string, unknown>,
      isActive: user.isActive,
      preferredLanguage: (user.preferredLanguage as string) ?? "fr",
      preferredTheme: (user.preferredTheme as string) ?? "dark",
    },
    plainPin,
  }
}

export interface UpdateUserInput {
  id: string
  name?: string
  role?: "admin" | "staff"
  portalAccess?: string[]
  modulePermissions?: Record<string, unknown>
}

export async function updateUser(input: UpdateUserInput): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  await prisma.user.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.role !== undefined && { role: input.role as any }),
      ...(input.portalAccess !== undefined && { portalAccess: input.portalAccess as any }),
      ...(input.modulePermissions !== undefined && {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        modulePermissions: input.modulePermissions as any,
      }),
    },
  })

  await logActivity({
    portal: "lm3allem",
    entityType: "user",
    entityId: input.id,
    actorId: session.user.id,
    action: "user.updated",
  })
}

export async function toggleUserActive(id: string): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const user = await prisma.user.findUniqueOrThrow({ where: { id } })

  if (user.role === "superadmin") {
    throw new Error("Cannot deactivate superadmin")
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
  })

  await logActivity({
    portal: "lm3allem",
    entityType: "user",
    entityId: id,
    actorId: session.user.id,
    action: user.isActive ? "user.deactivated" : "user.activated",
  })
}

export async function resetUserPin(
  id: string
): Promise<{ plainPin: string }> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const plainPin = generatePin()
  const hashedPin = await hashPin(plainPin)

  await prisma.user.update({
    where: { id },
    data: { pin: hashedPin },
  })

  await logActivity({
    portal: "lm3allem",
    entityType: "user",
    entityId: id,
    actorId: session.user.id,
    action: "user.pin_reset",
  })

  // Email — PIN reset notification to admin (non-blocking)
  try {
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      const userRecord = await prisma.user.findUnique({
        where:  { id },
        select: { name: true },
      })
      if (userRecord) {
        await sendMail(
          adminEmail,
          `PIN réinitialisé — ${userRecord.name}`,
          pinDeliveryHtml({ userName: userRecord.name, pin: plainPin, action: "reset" })
        )
      }
    }
  } catch {
    // Email failure must never break PIN reset
  }

  return { plainPin }
}