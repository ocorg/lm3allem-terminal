"use server"

import { Prisma } from "@prisma/client"
import type { Portal } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { requireAdmin } from "@/lib/auth/guard"
import { logActivity } from "@/lib/activity/logger"
import {
  generatePassword, hashPassword, isValidEmail, normalizeEmail,
} from "@/lib/auth/password"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { PORTAL_MODULES, normalizePermissions, type ModulePermissions } from "@/lib/permissions"
import { id, parseInput, asId } from "@/lib/validation"

/**
 * User management.
 *  - The ghost account is invisible here: never listed, never editable, never counted.
 *  - Admins and staff are created by an admin; every new / reset password is a one-time temporary
 *    password that the user must change at the first login.
 */

export interface SerializedUser {
  id: string
  name: string
  email: string | null
  role: string
  portalAccess: Portal[]
  modulePermissions: ModulePermissions
  isActive: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
}

const SELECT = {
  id: true, name: true, email: true, role: true, portalAccess: true, modulePermissions: true,
  isActive: true, mustChangePassword: true, lastLoginAt: true,
} satisfies Prisma.UserSelect

type Row = Prisma.UserGetPayload<{ select: typeof SELECT }>

function serialize(u: Row): SerializedUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    portalAccess: u.portalAccess,
    modulePermissions: normalizePermissions(u.modulePermissions),
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  }
}

export async function getUsers(): Promise<SerializedUser[]> {
  await requireAdmin()

  const users = await prisma.user.findMany({
    where:   { role: { not: "ghost" } },
    orderBy: { name: "asc" },
    select:  SELECT,
  })
  return users.map(serialize)
}

const permissionsSchema = z.record(z.string(), z.record(z.string(), z.boolean())).default({})

const baseSchema = z.object({
  name:              z.string().trim().min(1).max(120),
  email:             z.string().trim().min(3).max(254),
  role:              z.enum(["admin", "staff"]),
  portalAccess:      z.array(z.enum(["magazin", "costumes"])).max(2),
  modulePermissions: permissionsSchema,
})

export interface CreateUserInput {
  name: string
  email: string
  role: "admin" | "staff"
  portalAccess: Portal[]
  modulePermissions: ModulePermissions
}

export type UpdateUserInput = Partial<CreateUserInput> & { id: string }

function cleanPermissions(raw: unknown, portals: Portal[]): ModulePermissions {
  const normalized = normalizePermissions(raw)
  const out: ModulePermissions = {}
  for (const portal of Object.keys(PORTAL_MODULES)) {
    if (!portals.includes(portal as Portal)) continue
    out[portal] = normalized[portal] ?? {}
  }
  return out
}

async function assertManageable(targetId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true, isActive: true } })
  // A ghost account is invisible: to everyone else it simply does not exist.
  if (!target || target.role === "ghost") throw new ActionError("not_found")
  return target
}

async function assertAnotherActiveAdmin(excludingId: string) {
  const others = await prisma.user.count({ where: { role: "admin", isActive: true, id: { not: excludingId } } })
  if (others === 0) throw new ActionError("cannot_modify_user", "يجب أن يبقى مدير واحد نشط على الأقل")
}

export async function createUser(
  rawInput: CreateUserInput
): Promise<ActionResult<{ user: SerializedUser; temporaryPassword: string }>> {
  return run(async () => {
    const actor = await requireAdmin()
    const input = parseInput(baseSchema, rawInput)

    const email = normalizeEmail(input.email)
    if (!isValidEmail(email)) throw new ActionError("validation", "بريد إلكتروني غير صالح")

    const temporaryPassword = generatePassword()
    const portals = input.role === "admin" ? (["magazin", "costumes"] as Portal[]) : input.portalAccess

    let user: Row
    try {
      user = await prisma.user.create({
        data: {
          name:               input.name,
          email,
          passwordHash:       await hashPassword(temporaryPassword),
          mustChangePassword: true,
          role:               input.role,
          portalAccess:       portals,
          modulePermissions:  input.role === "staff" ? cleanPermissions(input.modulePermissions, portals) : {},
          isActive:           true,
        },
        select: SELECT,
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new ActionError("email_taken")
      throw err
    }

    await logActivity({
      portal: "lm3allem", entityType: "user", entityId: user.id, actor,
      action: "user.created", diff: { name: input.name, role: input.role, email },
    })

    return { user: serialize(user), temporaryPassword }
  })
}

export async function updateUser(rawInput: UpdateUserInput): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireAdmin()
    const userId = parseInput(id, rawInput.id)
    const target = await assertManageable(userId)

    const input = parseInput(baseSchema.partial(), {
      name: rawInput.name, email: rawInput.email, role: rawInput.role,
      portalAccess: rawInput.portalAccess, modulePermissions: rawInput.modulePermissions,
    })

    if (input.role && input.role !== target.role) {
      if (userId === actor.id) throw new ActionError("cannot_modify_user", "لا يمكنك تغيير دورك الخاص")
      if (target.role === "admin" && target.isActive) await assertAnotherActiveAdmin(userId)
    }

    const role = input.role ?? target.role
    const data: Prisma.UserUpdateInput = {}
    if (input.name !== undefined) data.name = input.name
    if (input.email !== undefined) {
      const email = normalizeEmail(input.email)
      if (!isValidEmail(email)) throw new ActionError("validation", "بريد إلكتروني غير صالح")
      data.email = email
    }
    if (input.role !== undefined) data.role = input.role
    if (role === "admin") {
      data.portalAccess = ["magazin", "costumes"]
      data.modulePermissions = {}
    } else if (input.portalAccess !== undefined || input.modulePermissions !== undefined) {
      const current = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { portalAccess: true, modulePermissions: true } })
      const portals = input.portalAccess ?? current.portalAccess
      data.portalAccess = portals
      data.modulePermissions = cleanPermissions(input.modulePermissions ?? current.modulePermissions, portals)
    }

    try {
      await prisma.user.update({ where: { id: userId }, data })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new ActionError("email_taken")
      throw err
    }

    await logActivity({
      portal: "lm3allem", entityType: "user", entityId: userId, actor, action: "user.updated",
    })
  })
}

export async function toggleUserActive(userId: string): Promise<ActionResult> {
  userId = asId(userId)
  return run(async () => {
    const actor  = await requireAdmin()
    const target = await assertManageable(userId)
    if (userId === actor.id) throw new ActionError("cannot_deactivate_self")
    if (target.role === "admin" && target.isActive) await assertAnotherActiveAdmin(userId)

    await prisma.user.update({
      where: { id: userId },
      // clearing the lock on re-activation avoids a "reactivated but still locked out" surprise
      data:  { isActive: !target.isActive, failedLogins: 0, lockedUntil: null },
    })

    await logActivity({
      portal: "lm3allem", entityType: "user", entityId: userId, actor,
      action: target.isActive ? "user.deactivated" : "user.activated",
    })
  })
}

/** Generates a one-time temporary password; the user must change it at the next login. */
export async function resetUserPassword(
  userId: string
): Promise<ActionResult<{ temporaryPassword: string }>> {
  userId = asId(userId)
  return run(async () => {
    const actor = await requireAdmin()
    await assertManageable(userId)
    if (userId === actor.id) throw new ActionError("cannot_modify_user", "غيّر كلمة مرورك من القائمة الشخصية")

    const temporaryPassword = generatePassword()
    await prisma.user.update({
      where: { id: userId },
      data:  {
        passwordHash:       await hashPassword(temporaryPassword),
        mustChangePassword: true,
        failedLogins:       0,
        lockedUntil:        null,
      },
    })

    await logActivity({
      portal: "lm3allem", entityType: "user", entityId: userId, actor, action: "user.password_reset",
    })

    return { temporaryPassword }
  })
}
