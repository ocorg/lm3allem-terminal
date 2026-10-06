"use server"

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { requireAnyModule, requireModule } from "@/lib/auth/guard"
import { logActivity } from "@/lib/activity/logger"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { isValidPhone, normalizePhone } from "@/lib/utils/phone"
import { optionalText, parseInput, asId } from "@/lib/validation"

// ── Shapes ─────────────────────────────────────────────────────
export interface ClientForList {
  id:          string
  name:        string
  phone:       string
  address:     string | null
  notes:       string | null
  rentalCount: number
  createdAt:   string
}

export interface ClientInput {
  name:     string
  phone:    string
  address?: string
  notes?:   string
}

const clientSchema = z.object({
  name:    z.string().trim().min(1).max(120),
  phone:   z.string().trim().min(1).max(40),
  address: optionalText(200),
  notes:   optionalText(500),
})

function cleanClient(raw: unknown) {
  const input = parseInput(clientSchema, raw)
  const phone = normalizePhone(input.phone)
  if (!isValidPhone(phone)) throw new ActionError("validation", "رقم الهاتف غير صالح")
  return { ...input, phone }
}

function isPhoneTaken(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
}

// ── getClients ─────────────────────────────────────────────────
// Needed by the clients screen AND by the rental wizard (client picker).
export async function getClients(): Promise<ClientForList[]> {
  await requireAnyModule("costumes", ["clients", "rentals"])

  const clients = await prisma.client.findMany({
    include: { _count: { select: { rentals: true } } },
    orderBy: { createdAt: "desc" },
    take:    5000,
  })
  return clients.map((c) => ({
    id:          c.id,
    name:        c.name,
    phone:       c.phone,
    address:     c.address,
    notes:       c.notes,
    rentalCount: c._count.rentals,
    createdAt:   c.createdAt.toISOString(),
  }))
}

// ── createClient ───────────────────────────────────────────────
export async function createClient(
  rawInput: ClientInput
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user  = await requireAnyModule("costumes", ["clients", "rentals"])
    const input = cleanClient(rawInput)

    let client
    try {
      client = await prisma.client.create({
        data: {
          name:    input.name,
          phone:   input.phone,
          address: input.address ?? null,
          notes:   input.notes   ?? null,
        },
      })
    } catch (err) {
      if (isPhoneTaken(err)) throw new ActionError("phone_taken")
      throw err
    }

    await logActivity({
      portal: "costumes", entityType: "client", entityId: client.id, actor: user,
      action: "client.created", diff: { name: input.name, phone: input.phone },
    })

    return { id: client.id }
  })
}

// ── updateClient ───────────────────────────────────────────────
export async function updateClient(
  clientId: string,
  rawInput: ClientInput
): Promise<ActionResult> {
  clientId = asId(clientId)
  return run(async () => {
    const user  = await requireModule("costumes", "clients")
    const input = cleanClient(rawInput)

    try {
      await prisma.client.update({
        where: { id: clientId },
        data: {
          name:    input.name,
          phone:   input.phone,
          address: input.address ?? null,
          notes:   input.notes   ?? null,
        },
      })
    } catch (err) {
      if (isPhoneTaken(err)) throw new ActionError("phone_taken")
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") throw new ActionError("not_found")
      throw err
    }

    await logActivity({
      portal: "costumes", entityType: "client", entityId: clientId, actor: user,
      action: "client.updated", diff: { name: input.name, phone: input.phone },
    })
  })
}
