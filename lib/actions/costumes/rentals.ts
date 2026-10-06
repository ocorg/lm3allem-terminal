"use server"

import { Prisma } from "@prisma/client"
import type { GuaranteeType, PaymentMethod, RentalStatus, TransactionType } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { getActiveLookups } from "@/lib/queries/lookups"
import { requireModule } from "@/lib/auth/guard"
import { logActivity } from "@/lib/activity/logger"
import { createNotification } from "@/lib/notifications/create"
import { assertOpenSession } from "@/lib/finance/session"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { isAdminRole } from "@/lib/permissions"
import { nextKitReference } from "@/lib/utils/counter"
import { D, toNum } from "@/lib/utils/money"
import { actorLabel } from "@/lib/utils/actor"
import { isValidPhone, normalizePhone } from "@/lib/utils/phone"
import { calendarDate, calendarKey, earliestTodayKey } from "@/lib/utils/time"
import {
  id, money, moneyPositive, optionalText, parseInput, requestId, settlementMethod, asId,
} from "@/lib/validation"
import type { LookupById } from "./pos"
import { formatMAD } from "@/lib/utils/currency"

// ── Shapes ─────────────────────────────────────────────────────
export interface RentalForList {
  id:                  string
  clientName:          string
  clientPhone:         string
  kitReference:        string | null
  status:              RentalStatus
  eventDate:           string | null
  scheduledPickupDate: string
  scheduledReturnDate: string
  totalAmount:         string
  amountPaid:          string
  balance:             string
  createdAt:           string
}

export interface KitItemForDetail {
  id:            string
  costumeItemId: string
  sku:           string | null
  name_ar:       string
  typeLabelAr:   string
  sizeId:        string | null
  pantsSizeId:   string | null
  shirtSizeId:   string | null
  shoeSizeId:    string | null
  quantity:      number
  returned:      boolean
}

export interface RentalDetail extends RentalForList {
  notes:             string | null
  guaranteeType:     GuaranteeType
  guaranteeAmount:   string | null
  guaranteePhotoUrl: string | null
  depositApplied:    boolean
  depositReturned:   boolean
  /** deposit money currently held (collected minus returned), 0 when none */
  depositHeld:       string
  cancelledAt:       string | null
  cancelReason:      string | null
  kitItems: KitItemForDetail[]
  payments: {
    id:        string
    amount:    string
    method:    string
    type:      string
    actorName: string
    createdAt: string
  }[]
}

export interface RentalKitItemInput {
  costumeItemId: string
  quantity:      number
}

export interface CreateRentalInput {
  /** idempotency key: a retried request returns the first rental */
  requestId:           string
  caisseSessionId:     string
  /** existing client … */
  clientId?:           string
  /** … or a new one, created in the SAME transaction as the rental */
  newClient?:          { name: string; phone: string; address?: string }
  eventDate?:          string
  scheduledPickupDate: string
  scheduledReturnDate: string
  totalAmount:         number
  amountPaid:          number
  paymentMethod:       "cash" | "tpe" | "banque"
  guaranteeType:       GuaranteeType
  guaranteeAmount?:    number
  guaranteePhotoUrl?:  string
  notes?:              string
  kitItems:            RentalKitItemInput[]
}

export interface AddPaymentInput {
  rentalId:        string
  caisseSessionId: string
  amount:          number
  method:          "cash" | "tpe" | "banque"
  type:            "rental_payment" | "remaining_balance" | "deposit_collected" | "deposit_returned"
}

export interface UpdateRentalInput {
  eventDate?:           string | null
  scheduledPickupDate?: string
  scheduledReturnDate?: string
  totalAmount?:         number
  notes?:               string | null
}

export interface CancelRentalInput {
  reason: string
  /** optional refund of money already received */
  refund?: { amount: number; method: "cash" | "tpe" | "banque"; caisseSessionId: string }
}

// ── Validation ─────────────────────────────────────────────────
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const photoUrl = z.string().max(600).refine(
  (u) => /^https:\/\//.test(u) || u.startsWith("/api/files/"),
  { message: "invalid photo" }
)

const createSchema = z.object({
  requestId,
  caisseSessionId: id,
  clientId:  id.optional(),
  newClient: z.object({
    name:    z.string().trim().min(1).max(120),
    phone:   z.string().trim().min(1).max(40),
    address: optionalText(200),
  }).optional(),
  eventDate:           dateOnly.optional(),
  scheduledPickupDate: dateOnly,
  scheduledReturnDate: dateOnly,
  totalAmount:         moneyPositive,
  amountPaid:          money,
  paymentMethod:       settlementMethod,
  guaranteeType:       z.enum(["cash_deposit", "id_card", "passport", "drivers_license"]),
  guaranteeAmount:     moneyPositive.optional(),
  guaranteePhotoUrl:   photoUrl.optional(),
  notes:               optionalText(1000),
  kitItems: z.array(z.object({
    costumeItemId: id,
    quantity:      z.number().int().min(1).max(1000),
  })).min(1).max(100),
})

const paymentSchema = z.object({
  rentalId:        id,
  caisseSessionId: id,
  amount:          moneyPositive,
  method:          settlementMethod,
  type:            z.enum(["rental_payment", "remaining_balance", "deposit_collected", "deposit_returned"]),
})

const updateSchema = z.object({
  eventDate:           dateOnly.nullable().optional(),
  scheduledPickupDate: dateOnly.optional(),
  scheduledReturnDate: dateOnly.optional(),
  totalAmount:         moneyPositive.optional(),
  notes:               z.string().trim().max(1000).nullable().optional(),
})

const cancelSchema = z.object({
  reason: z.string().trim().min(3).max(300),
  refund: z.object({
    amount:          moneyPositive,
    method:          settlementMethod,
    caisseSessionId: id,
  }).optional(),
})

const CANCELLABLE: RentalStatus[] = ["booked", "in_preparation", "ready_for_pickup"]
const EDITABLE:    RentalStatus[] = ["booked", "in_preparation", "ready_for_pickup"]

// ── getRentals ─────────────────────────────────────────────────
export async function getRentals(): Promise<RentalForList[]> {
  await requireModule("costumes", "rentals")

  const rentals = await prisma.rental.findMany({
    include: {
      client: { select: { name: true, phone: true } },
      kit:    { select: { reference: true } },
    },
    orderBy: { createdAt: "desc" },
    take:    3000,
  })
  return rentals.map((r) => ({
    id:                  r.id,
    clientName:          r.client.name,
    clientPhone:         r.client.phone,
    kitReference:        r.kit?.reference ?? null,
    status:              r.status,
    eventDate:           r.eventDate?.toISOString() ?? null,
    scheduledPickupDate: r.scheduledPickupDate.toISOString(),
    scheduledReturnDate: r.scheduledReturnDate.toISOString(),
    totalAmount:         r.totalAmount.toString(),
    amountPaid:          r.amountPaid.toString(),
    balance:             r.balance.toString(),
    createdAt:           r.createdAt.toISOString(),
  }))
}

// ── getRentalById ──────────────────────────────────────────────
export async function getRentalById(
  rentalId: string
): Promise<RentalDetail | null> {
  rentalId = asId(rentalId)
  await requireModule("costumes", "rentals")

  const r = await prisma.rental.findUnique({
    where:   { id: rentalId },
    include: {
      client:       { select: { name: true, phone: true } },
      kit: {
        include: {
          items: {
            include: {
              costumeItem: {
                select: {
                  sku: true, name_ar: true, sizeId: true, colorId: true, shirtSizeId: true, shoeSizeId: true,
                  costumeType: { select: { label_ar: true } },
                },
              },
            },
          },
        },
      },
      payments: {
        include: { recordedBy: { select: { name: true, role: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  })
  if (!r) return null

  const collected = r.payments.filter((p) => p.type === "deposit_collected").reduce((s, p) => s.plus(p.amount), D(0))
  const returned  = r.payments.filter((p) => p.type === "deposit_returned").reduce((s, p) => s.plus(p.amount), D(0))

  return {
    id:                  r.id,
    clientName:          r.client.name,
    clientPhone:         r.client.phone,
    kitReference:        r.kit?.reference ?? null,
    status:              r.status,
    eventDate:           r.eventDate?.toISOString() ?? null,
    scheduledPickupDate: r.scheduledPickupDate.toISOString(),
    scheduledReturnDate: r.scheduledReturnDate.toISOString(),
    totalAmount:         r.totalAmount.toString(),
    amountPaid:          r.amountPaid.toString(),
    balance:             r.balance.toString(),
    notes:               r.notes,
    guaranteeType:       r.guaranteeType,
    guaranteeAmount:     r.guaranteeAmount?.toString() ?? null,
    guaranteePhotoUrl:   r.guaranteePhotoUrl,
    depositApplied:      r.depositApplied,
    depositReturned:     r.depositReturned,
    depositHeld:         collected.minus(returned).toString(),
    cancelledAt:         r.cancelledAt?.toISOString() ?? null,
    cancelReason:        r.cancelReason,
    createdAt:           r.createdAt.toISOString(),
    kitItems: (r.kit?.items ?? []).map((ki) => ({
      id:            ki.id,
      costumeItemId: ki.costumeItemId,
      sku:           ki.costumeItem.sku,
      name_ar:       ki.costumeItem.name_ar,
      typeLabelAr:   ki.costumeItem.costumeType.label_ar,
      sizeId:        ki.costumeItem.sizeId,
      pantsSizeId:   ki.costumeItem.colorId,
      shirtSizeId:   ki.costumeItem.shirtSizeId,
      shoeSizeId:    ki.costumeItem.shoeSizeId,
      quantity:      ki.quantity,
      returned:      ki.returned,
    })),
    payments: r.payments.map((p) => ({
      id:        p.id,
      amount:    p.amount.toString(),
      method:    p.method,
      type:      p.type,
      actorName: actorLabel(p.recordedBy),
      createdAt: p.createdAt.toISOString(),
    })),
  }
}

// ── createRental ───────────────────────────────────────────────
export async function createRental(
  rawInput: CreateRentalInput
): Promise<ActionResult<{ rentalId: string; kitReference: string }>> {
  return run(async () => {
    const user  = await requireModule("costumes", "rentals")
    const input = parseInput(createSchema, rawInput)

    if (!input.clientId === !input.newClient) throw new ActionError("validation", "اختر عميلا أو أضف عميلا جديدا")
    // Date logic (strings are "YYYY-MM-DD", which compare correctly as text):
    //   today <= pickup <= event <= return
    if (input.scheduledPickupDate < earliestTodayKey()) throw new ActionError("invalid_dates", "تاريخ الاستلام لا يمكن أن يكون في الماضي")
    if (input.scheduledReturnDate < input.scheduledPickupDate) throw new ActionError("invalid_dates")
    if (input.eventDate && (input.eventDate < input.scheduledPickupDate || input.eventDate > input.scheduledReturnDate)) {
      throw new ActionError("invalid_dates", "يجب أن يكون تاريخ المناسبة بين تاريخ الاستلام وتاريخ الإرجاع")
    }
    if (input.amountPaid > input.totalAmount) throw new ActionError("invalid_amount")
    if (input.guaranteeType === "cash_deposit" && !input.guaranteeAmount) {
      throw new ActionError("validation", "مبلغ الضمان النقدي مطلوب")
    }

    // Idempotency: a retried submission returns the first rental
    const existing = await prisma.rental.findUnique({
      where:  { requestId: input.requestId },
      select: { id: true, createdById: true, kit: { select: { reference: true } } },
    })
    if (existing) {
      if (existing.createdById !== user.id) throw new ActionError("validation")
      return { rentalId: existing.id, kitReference: existing.kit?.reference ?? "" }
    }

    const balance = D(input.totalAmount).minus(input.amountPaid)

    let result: { rentalId: string; kitReference: string; clientName: string; clientPhone: string }
    try {
      result = await prisma.$transaction(async (tx) => {
        await assertOpenSession(tx, input.caisseSessionId, "costumes")

        // Client: the new client is created in the same transaction, so a failure leaves no orphan.
        let client: { id: string; name: string; phone: string }
        if (input.clientId) {
          const found = await tx.client.findUnique({ where: { id: input.clientId }, select: { id: true, name: true, phone: true } })
          if (!found) throw new ActionError("not_found")
          client = found
        } else {
          const phone = normalizePhone(input.newClient!.phone)
          if (!isValidPhone(phone)) throw new ActionError("validation", "رقم الهاتف غير صالح")
          const dup = await tx.client.findUnique({ where: { phone }, select: { name: true } })
          if (dup) throw new ActionError("phone_taken", `رقم الهاتف مستخدم بالفعل لدى العميل: ${dup.name}`)
          client = await tx.client.create({
            data:   { name: input.newClient!.name, phone, address: input.newClient!.address ?? null },
            select: { id: true, name: true, phone: true },
          })
        }

        // Kit items: only active RENTAL items, reserved with an atomic guarded decrement.
        const wanted = new Map<string, number>()
        for (const ki of input.kitItems) wanted.set(ki.costumeItemId, (wanted.get(ki.costumeItemId) ?? 0) + ki.quantity)

        const items = await tx.costumeItem.findMany({ where: { id: { in: [...wanted.keys()] } }, select: { id: true, isActive: true, segment: true } })
        if (items.length !== wanted.size) throw new ActionError("not_found")
        if (items.some((i) => !i.isActive || i.segment !== "rental")) throw new ActionError("item_unavailable")

        for (const [itemId, quantity] of wanted) {
          const res = await tx.costumeItem.updateMany({
            where: { id: itemId, stock: { gte: quantity } },
            data:  { stock: { decrement: quantity } },
          })
          if (res.count !== 1) throw new ActionError("insufficient_stock")
        }

        const reference = await nextKitReference(tx)

        const rental = await tx.rental.create({
          data: {
            requestId:           input.requestId,
            clientId:            client.id,
            status:              "booked",
            eventDate:           input.eventDate ? calendarDate(input.eventDate) : null,
            scheduledPickupDate: calendarDate(input.scheduledPickupDate),
            scheduledReturnDate: calendarDate(input.scheduledReturnDate),
            totalAmount:         input.totalAmount,
            amountPaid:          input.amountPaid,
            balance,
            guaranteeType:       input.guaranteeType,
            guaranteeAmount:     input.guaranteeType === "cash_deposit" ? input.guaranteeAmount ?? null : null,
            guaranteePhotoUrl:   input.guaranteePhotoUrl ?? null,
            notes:               input.notes ?? null,
            createdById:         user.id,
            kit: {
              create: {
                reference,
                items: { create: [...wanted].map(([costumeItemId, quantity]) => ({ costumeItemId, quantity })) },
              },
            },
          },
        })

        // The advance is recorded in the cash ledger. (A cash deposit is recorded separately,
        // when it is physically collected: see addRentalPayment / deposit_collected.)
        if (input.amountPaid > 0) {
          await tx.rentalPayment.create({
            data: {
              rentalId:        rental.id,
              caisseSessionId: input.caisseSessionId,
              amount:          input.amountPaid,
              method:          input.paymentMethod,
              type:            "rental_payment",
              recordedById:    user.id,
            },
          })
        }

        return { rentalId: rental.id, kitReference: reference, clientName: client.name, clientPhone: client.phone }
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const winner = await prisma.rental.findUnique({
          where: { requestId: input.requestId }, select: { id: true, kit: { select: { reference: true } } },
        })
        if (winner) return { rentalId: winner.id, kitReference: winner.kit?.reference ?? "" }
        // unique clash on the client phone created concurrently
        throw new ActionError("phone_taken")
      }
      throw err
    }

    await logActivity({
      portal: "costumes", entityType: "rental", entityId: result.rentalId, actor: user,
      action: "rental.created",
      diff: {
        totalAmount: input.totalAmount, amountPaid: input.amountPaid,
        balance: toNum(balance), kitItemCount: input.kitItems.length, kit: result.kitReference,
      },
    })

    await createNotification({
      title:  "إيجار جديد",
      body:   `${result.kitReference} · ${result.clientName}
المجموع: ${formatMAD(input.totalAmount)} | المدفوع: ${formatMAD(input.amountPaid)} | المتبقي: ${formatMAD(toNum(balance))}
الاستلام: ${input.scheduledPickupDate} · الإرجاع: ${input.scheduledReturnDate}`,
      type:   "rental",
      portal: "costumes",
      actor:  user,
    })

    return { rentalId: result.rentalId, kitReference: result.kitReference }
  })
}

// ── getRentalItems ─────────────────────────────────────────────
export interface CostumeItemForRental {
  id:            string
  sku:           string | null
  name_ar:       string
  typeId:        string
  typeLabelAr:   string
  sizeId:        string | null
  colorId:       string | null
  shirtSizeId:   string | null
  shoeSizeId:    string | null
  stock:         number
  refGuidePrice: string | null
  images:        string[]
}

export async function getRentalItems(): Promise<{
  items:      CostumeItemForRental[]
  lookupById: LookupById
}> {
  await requireModule("costumes", "rentals")

  const [rawItems, rawLookup] = await Promise.all([
    prisma.costumeItem.findMany({
      where:   { isActive: true, stock: { gt: 0 }, segment: "rental" },
      include: { costumeType: true },
      orderBy: [{ costumeType: { order: "asc" } }, { sku: "asc" }],
    }),
    getActiveLookups(),
  ])

  const lookupById: LookupById = {}
  for (const lv of rawLookup) {
    lookupById[lv.id] = { label_fr: lv.label_fr, label_ar: lv.label_ar }
  }

  return {
    items: rawItems.map((i) => ({
      id:            i.id,
      sku:           i.sku,
      name_ar:       i.name_ar,
      typeId:        i.typeId,
      typeLabelAr:   i.costumeType.label_ar,
      sizeId:        i.sizeId,
      colorId:       i.colorId,
      shirtSizeId:   i.shirtSizeId,
      shoeSizeId:    i.shoeSizeId,
      stock:         i.stock,
      refGuidePrice: i.refGuidePrice?.toString() ?? null,
      images:        i.images,
    })),
    lookupById,
  }
}

// ── advanceRentalStatus ────────────────────────────────────────
const STATUS_FLOW: Partial<Record<RentalStatus, RentalStatus>> = {
  booked:           "in_preparation",
  in_preparation:   "ready_for_pickup",
  ready_for_pickup: "picked_up",
  picked_up:        "returned",
  returned:         "cleaning",
  cleaning:         "available",
}

export async function advanceRentalStatus(
  rentalId: string
): Promise<ActionResult<{ newStatus: RentalStatus }>> {
  return run(async () => {
    const user = await requireModule("costumes", "rentals")

    const rental = await prisma.rental.findUnique({
      where:  { id: rentalId },
      select: {
        status: true, balance: true, depositApplied: true, depositReturned: true,
        kit: { include: { items: { select: { costumeItemId: true, quantity: true } } } },
      },
    })
    if (!rental) throw new ActionError("not_found")

    const next = STATUS_FLOW[rental.status]
    if (!next) throw new ActionError("rental_closed")

    // Business rules - admins (and the ghost account) may override them.
    const isAdmin = isAdminRole(user.role)
    if (next === "picked_up" && D(rental.balance).greaterThan(0) && !isAdmin) {
  rentalId = asId(rentalId)
      throw new ActionError("balance_unpaid")
    }
    if (next === "available" && rental.depositApplied && !rental.depositReturned && !isAdmin) {
      throw new ActionError("deposit_not_returned")
    }

    await prisma.$transaction(async (tx) => {
      // Guarded on the CURRENT status: two simultaneous clicks cannot advance twice
      // (which would restore the stock twice).
      const res = await tx.rental.updateMany({
        where: { id: rentalId, status: rental.status },
        data: {
          status:           next,
          actualPickupDate: next === "picked_up" ? new Date() : undefined,
          actualReturnDate: next === "returned"  ? new Date() : undefined,
        },
      })
      if (res.count !== 1) throw new ActionError("invalid_status")

      // Stock is released only when the kit is back, cleaned and available again
      if (next === "available" && rental.kit) {
        for (const ki of rental.kit.items) {
          await tx.costumeItem.update({
            where: { id: ki.costumeItemId },
            data:  { stock: { increment: ki.quantity } },
          })
        }
      }
    })

    await logActivity({
      portal: "costumes", entityType: "rental", entityId: rentalId, actor: user,
      action: "rental.status_changed", diff: { from: rental.status, to: next },
    })

    return { newStatus: next }
  })
}

// ── cancelRental ───────────────────────────────────────────────
export async function cancelRental(
  rentalId: string,
  rawInput: CancelRentalInput
): Promise<ActionResult> {
  return run(async () => {
    const user  = await requireModule("costumes", "rentals")
    const input = parseInput(cancelSchema, rawInput)

    const rental = await prisma.rental.findUnique({
      where:  { id: rentalId },
      select: {
        status: true, amountPaid: true,
        kit: { include: { items: { select: { costumeItemId: true, quantity: true } } } },
      },
    })
    if (!rental) throw new ActionError("not_found")
    if (!CANCELLABLE.includes(rental.status)) throw new ActionError("invalid_status")
    if (input.refund && D(input.refund.amount).greaterThan(rental.amountPaid)) {
      throw new ActionError("amount_exceeds_balance", "مبلغ الاسترجاع أكبر من المبلغ المدفوع")
    }

    await prisma.$transaction(async (tx) => {
      if (input.refund) await assertOpenSession(tx, input.refund.caisseSessionId, "costumes")

      const res = await tx.rental.updateMany({
        where: { id: rentalId, status: rental.status },
        data: {
          status:       "cancelled",
          cancelledAt:  new Date(),
          cancelReason: input.reason,
          balance:      0,
          ...(input.refund ? { amountPaid: { decrement: input.refund.amount } } : {}),
        },
      })
      if (res.count !== 1) throw new ActionError("invalid_status")

      // Release the reserved stock
      for (const ki of rental.kit?.items ?? []) {
        await tx.costumeItem.update({
          where: { id: ki.costumeItemId },
          data:  { stock: { increment: ki.quantity } },
        })
      }

      if (input.refund) {
        await tx.rentalPayment.create({
          data: {
            rentalId,
            caisseSessionId: input.refund.caisseSessionId,
            amount:          input.refund.amount,
            method:          input.refund.method,
            type:            "rental_refund",
            recordedById:    user.id,
          },
        })
      }
    })

    await logActivity({
      portal: "costumes", entityType: "rental", entityId: rentalId, actor: user,
      action: "rental.cancelled",
      diff: { reason: input.reason, ...(input.refund ? { refund: input.refund.amount } : {}) },
    })
  })
}

// ── updateRental ───────────────────────────────────────────────
// Dates, total and notes can be corrected until the kit leaves the shop.
export async function updateRental(
  rentalId: string,
  rawInput: UpdateRentalInput
): Promise<ActionResult> {
  return run(async () => {
    const user  = await requireModule("costumes", "rentals")
    const input = parseInput(updateSchema, rawInput)

    const rental = await prisma.rental.findUnique({
      where:  { id: rentalId },
      select: { status: true, amountPaid: true, eventDate: true, scheduledPickupDate: true, scheduledReturnDate: true },
    })
    if (!rental) throw new ActionError("not_found")
    if (!EDITABLE.includes(rental.status)) throw new ActionError("invalid_status")

    const pickup = input.scheduledPickupDate ? calendarDate(input.scheduledPickupDate) : rental.scheduledPickupDate
    const ret    = input.scheduledReturnDate ? calendarDate(input.scheduledReturnDate) : rental.scheduledReturnDate
    if (ret.getTime() < pickup.getTime()) throw new ActionError("invalid_dates")

    // the event (if any) must fall between pickup and return
    const eventKey = input.eventDate !== undefined
      ? input.eventDate
      : rental.eventDate ? calendarKey(rental.eventDate) : null
    if (eventKey && (eventKey < calendarKey(pickup) || eventKey > calendarKey(ret))) {
      throw new ActionError("invalid_dates", "يجب أن يكون تاريخ المناسبة بين تاريخ الاستلام وتاريخ الإرجاع")
    }

    const data: Prisma.RentalUpdateInput = {
      scheduledPickupDate: pickup,
      scheduledReturnDate: ret,
    }
    if (input.eventDate !== undefined) data.eventDate = input.eventDate ? calendarDate(input.eventDate) : null
    if (input.notes !== undefined)     data.notes     = input.notes || null
    if (input.totalAmount !== undefined) {
      if (D(input.totalAmount).lessThan(rental.amountPaid)) {
        throw new ActionError("invalid_amount", "المجموع أقل من المبلغ المدفوع بالفعل")
      }
      data.totalAmount = input.totalAmount
      data.balance     = D(input.totalAmount).minus(rental.amountPaid)
    }

    await prisma.rental.update({ where: { id: rentalId }, data })

    await logActivity({
      portal: "costumes", entityType: "rental", entityId: rentalId, actor: user,
      action: "rental.updated", diff: JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue,
    })
  })
}

// ── addRentalPayment ───────────────────────────────────────────
//   rental_payment / remaining_balance : money for the rental (reduces the balance, is revenue)
//   deposit_collected                  : refundable guarantee (NOT revenue, does not touch the balance)
//   deposit_returned                   : guarantee handed back (cash outflow)
export async function addRentalPayment(
  rawInput: AddPaymentInput
): Promise<ActionResult> {
  return run(async () => {
    const user  = await requireModule("costumes", "rentals")
    const input = parseInput(paymentSchema, rawInput)

    const type: TransactionType = input.type
    const method: PaymentMethod = input.method

    await prisma.$transaction(async (tx) => {
      await assertOpenSession(tx, input.caisseSessionId, "costumes")

      const rental = await tx.rental.findUnique({
        where:  { id: input.rentalId },
        select: {
          status: true, balance: true, guaranteeAmount: true, depositApplied: true, depositReturned: true,
        },
      })
      if (!rental) throw new ActionError("not_found")
      // A cancelled rental can still have its deposit handed back; nothing else.
      if (rental.status === "cancelled" && type !== "deposit_returned") throw new ActionError("rental_closed")

      if (type === "rental_payment" || type === "remaining_balance") {
        if (D(rental.balance).lessThanOrEqualTo(0)) throw new ActionError("nothing_to_pay")
        // Guarded atomic update: the balance can never go negative, even with two cashiers at once
        const res = await tx.rental.updateMany({
          where: { id: input.rentalId, balance: { gte: input.amount } },
          data:  { amountPaid: { increment: input.amount }, balance: { decrement: input.amount } },
        })
        if (res.count !== 1) throw new ActionError("amount_exceeds_balance")
      } else if (type === "deposit_collected") {
        if (rental.depositApplied) throw new ActionError("deposit_state", "تم استلام الضمان بالفعل")
        if (rental.guaranteeAmount && D(input.amount).greaterThan(rental.guaranteeAmount)) {
          throw new ActionError("deposit_state", "مبلغ الضمان أكبر من المبلغ المتفق عليه")
        }
        await tx.rental.update({ where: { id: input.rentalId }, data: { depositApplied: true } })
      } else {
        if (!rental.depositApplied || rental.depositReturned) throw new ActionError("deposit_state")
        const agg = await tx.rentalPayment.aggregate({
          where: { rentalId: input.rentalId, type: "deposit_collected" },
          _sum:  { amount: true },
        })
        if (D(input.amount).greaterThan(D(agg._sum.amount))) {
          throw new ActionError("deposit_state", "مبلغ الإرجاع أكبر من الضمان المستلم")
        }
        await tx.rental.update({ where: { id: input.rentalId }, data: { depositReturned: true } })
      }

      await tx.rentalPayment.create({
        data: {
          rentalId:        input.rentalId,
          caisseSessionId: input.caisseSessionId,
          amount:          input.amount,
          method,
          type,
          recordedById:    user.id,
        },
      })
    })

    await logActivity({
      portal: "costumes", entityType: "rental_payment", entityId: input.rentalId, actor: user,
      action: "rental.payment_added", diff: { amount: input.amount, type, method },
    })
  })
}

// ── setKitItemReturned ─────────────────────────────────────────
export async function setKitItemReturned(
  kitItemId: string,
  returned:  boolean
): Promise<ActionResult> {
  return run(async () => {
    const user = await requireModule("costumes", "rentals")
    if (typeof returned !== "boolean") throw new ActionError("validation")

    const item = await prisma.rentalKitItem.findUnique({
      where:   { id: kitItemId },
      include: { kit: { select: { rentalId: true, rental: { select: { status: true } } } } },
    })
    if (!item) throw new ActionError("not_found")
    if (!["picked_up", "returned", "cleaning"].includes(item.kit.rental.status)) {
      throw new ActionError("invalid_status")
    }

    await prisma.rentalKitItem.update({ where: { id: kitItemId }, data: { returned } })

    await logActivity({
      portal: "costumes", entityType: "rental", entityId: item.kit.rentalId, actor: user,
      action: returned ? "rental.item_returned" : "rental.item_unreturned", diff: { kitItemId },
    })
  })
}

