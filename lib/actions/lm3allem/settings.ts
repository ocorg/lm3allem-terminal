"use server"

import { prisma } from "@/lib/db/prisma"
import { requireAdmin } from "@/lib/auth/guard"
import { logActivity } from "@/lib/activity/logger"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { DEFAULT_STAFF_PERMISSIONS, normalizePermissions, type ModulePermissions } from "@/lib/permissions"
import { invalidateMaintenanceCache } from "@/lib/utils/maintenance"
import { z } from "zod"
import { id, parseInput } from "@/lib/validation"
import { MAX_RETURN_WINDOW_DAYS, MIN_RETURN_WINDOW_DAYS } from "@/lib/returns/window"

export interface SerializedSettings {
  id: string
  maintenanceMode: boolean
  maintenanceMessage_fr: string | null
  maintenanceMessage_ar: string | null
  defaultStaffPermissions: ModulePermissions
  /** shop sales can be returned during this many days (after that: admins only) */
  returnWindowDays: number
}

export async function getSystemSettings(): Promise<SerializedSettings> {
  await requireAdmin()

  let settings = await prisma.systemSettings.findFirst()

  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: {
        maintenanceMode: false,
        defaultStaffPermissions: DEFAULT_STAFF_PERMISSIONS,
      },
    })
  }

  const defaults = normalizePermissions(settings.defaultStaffPermissions)

  return {
    id: settings.id,
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage_fr: settings.maintenanceMessage_fr ?? null,
    maintenanceMessage_ar: settings.maintenanceMessage_ar ?? null,
    // fall back to the built-in defaults while the stored value is empty / legacy-shaped
    defaultStaffPermissions: Object.keys(defaults).length ? defaults : DEFAULT_STAFF_PERMISSIONS,
    returnWindowDays: settings.returnWindowDays,
  }
}

export interface UpdateSettingsInput {
  id: string
  maintenanceMode?: boolean
  maintenanceMessage_ar?: string | null
  defaultStaffPermissions?: ModulePermissions
  returnWindowDays?: number
}

const updateSchema = z.object({
  id,
  maintenanceMode:         z.boolean().optional(),
  maintenanceMessage_ar:   z.string().max(500).nullable().optional(),
  defaultStaffPermissions: z.record(z.string(), z.record(z.string(), z.boolean())).optional(),
  returnWindowDays:        z.number().int().min(MIN_RETURN_WINDOW_DAYS).max(MAX_RETURN_WINDOW_DAYS).optional(),
})

export async function updateSystemSettings(
  rawInput: UpdateSettingsInput
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireAdmin()

    // Strict shape: a missing id would otherwise match every row, and any non-empty text would
    // count as "maintenance ON".
    const input = parseInput(updateSchema, rawInput)
    const message = input.maintenanceMessage_ar
    const before = await prisma.systemSettings.findUnique({ where: { id: input.id }, select: { returnWindowDays: true } })

    const res = await prisma.systemSettings.updateMany({
      where: { id: input.id },
      data: {
        ...(input.maintenanceMode !== undefined && { maintenanceMode: input.maintenanceMode }),
        ...(message !== undefined && { maintenanceMessage_ar: message?.trim() || null }),
        ...(input.defaultStaffPermissions !== undefined && {
          defaultStaffPermissions: normalizePermissions(input.defaultStaffPermissions),
        }),
        ...(input.returnWindowDays !== undefined && { returnWindowDays: input.returnWindowDays }),
      },
    })
    if (res.count === 0) throw new ActionError("not_found")

    invalidateMaintenanceCache()

    await logActivity({
      portal: "lm3allem", entityType: "settings", entityId: input.id, actor,
      action: "settings.updated",
      diff: {
        maintenanceMode: input.maintenanceMode ?? null,
        ...(input.returnWindowDays !== undefined && before && before.returnWindowDays !== input.returnWindowDays
          ? { returnWindowDays: { from: before.returnWindowDays, to: input.returnWindowDays } }
          : {}),
      },
    })
  })
}
