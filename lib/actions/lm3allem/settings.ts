"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/prisma"
import { logActivity } from "@/lib/activity/logger"

export interface SerializedSettings {
  id: string
  maintenanceMode: boolean
  maintenanceMessage_fr: string | null
  maintenanceMessage_ar: string | null
  defaultStaffPermissions: Record<string, unknown>
}

export async function getSystemSettings(): Promise<SerializedSettings> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  let settings = await prisma.systemSettings.findFirst()

  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: {
        maintenanceMode: false,
        defaultStaffPermissions: {},
      },
    })
  }

  return {
    id: settings.id,
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage_fr: settings.maintenanceMessage_fr ?? null,
    maintenanceMessage_ar: settings.maintenanceMessage_ar ?? null,
    defaultStaffPermissions: (settings.defaultStaffPermissions ??
      {}) as Record<string, unknown>,
  }
}

export interface UpdateSettingsInput {
  id: string
  maintenanceMode?: boolean
  maintenanceMessage_fr?: string | null
  maintenanceMessage_ar?: string | null
  defaultStaffPermissions?: Record<string, unknown>
}

export async function updateSystemSettings(
  input: UpdateSettingsInput
): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  await prisma.systemSettings.update({
    where: { id: input.id },
    data: {
      ...(input.maintenanceMode !== undefined && {
        maintenanceMode: input.maintenanceMode,
      }),
      ...(input.maintenanceMessage_fr !== undefined && {
        maintenanceMessage_fr: input.maintenanceMessage_fr,
      }),
      ...(input.maintenanceMessage_ar !== undefined && {
        maintenanceMessage_ar: input.maintenanceMessage_ar,
      }),
      ...(input.defaultStaffPermissions !== undefined && {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        defaultStaffPermissions: input.defaultStaffPermissions as any,
      }),
    },
  })

  await logActivity({
    portal: "lm3allem",
    entityType: "settings",
    entityId: input.id,
    actorId: session.user.id,
    action: "settings.updated",
    diff: { maintenanceMode: input.maintenanceMode },
  })
}