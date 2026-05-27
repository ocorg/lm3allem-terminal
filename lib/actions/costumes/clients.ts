"use server"

import { prisma }      from "@/lib/db/prisma"
import { auth }        from "@/lib/auth/auth"
import { logActivity } from "@/lib/activity/logger"

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

export interface MeasurementForDetail {
  id:         string
  categoryId: string
  value:      string
  unit:       string | null
  recordedAt: string
}

export interface ClientDetail extends ClientForList {
  measurements: MeasurementForDetail[]
}

export interface ClientInput {
  name:     string
  phone:    string
  address?: string
  notes?:   string
}

// ── getClients ─────────────────────────────────────────────────
export async function getClients(): Promise<ClientForList[]> {
  const clients = await prisma.client.findMany({
    include: { _count: { select: { rentals: true } } },
    orderBy: { createdAt: "desc" },
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

// ── getClientById ──────────────────────────────────────────────
export async function getClientById(
  id: string
): Promise<ClientDetail | null> {
  const c = await prisma.client.findUnique({
    where:   { id },
    include: {
      _count:       { select: { rentals: true } },
      measurements: { orderBy: { recordedAt: "desc" } },
    },
  })
  if (!c) return null
  return {
    id:          c.id,
    name:        c.name,
    phone:       c.phone,
    address:     c.address,
    notes:       c.notes,
    rentalCount: c._count.rentals,
    createdAt:   c.createdAt.toISOString(),
    measurements: c.measurements.map((m) => ({
      id:         m.id,
      categoryId: m.categoryId,
      value:      m.value,
      unit:       m.unit,
      recordedAt: m.recordedAt.toISOString(),
    })),
  }
}

// ── createClient ───────────────────────────────────────────────
export async function createClient(
  input: ClientInput
): Promise<{ id: string }> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")

  const client = await prisma.client.create({
    data: {
      name:    input.name,
      phone:   input.phone,
      address: input.address ?? null,
      notes:   input.notes   ?? null,
    },
  })

  await logActivity({
    portal:     "costumes",
    entityType: "client",
    entityId:   client.id,
    actorId:    authSession.user.id,
    action:     "client.created",
    diff:       { name: input.name, phone: input.phone },
  })

  return { id: client.id }
}

// ── updateClient ───────────────────────────────────────────────
export async function updateClient(
  id: string,
  input: ClientInput
): Promise<void> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")

  await prisma.client.update({
    where: { id },
    data: {
      name:    input.name,
      phone:   input.phone,
      address: input.address ?? null,
      notes:   input.notes   ?? null,
    },
  })

  await logActivity({
    portal:     "costumes",
    entityType: "client",
    entityId:   id,
    actorId:    authSession.user.id,
    action:     "client.updated",
    diff:       { name: input.name, phone: input.phone },
  })
}