"use server"

import { prisma }               from "@/lib/db/prisma"
import { auth }                 from "@/lib/auth/auth"
import { logActivity }          from "@/lib/activity/logger"
import { generateKitReference }   from "@/lib/utils/kit-reference"
import { sendMail }                from "@/lib/email/mailer"
import { rentalConfirmationHtml }  from "@/lib/email/templates"
import { createNotification }       from "@/lib/notifications/create"
import type {
  RentalStatus,
  GuaranteeType,
  PaymentMethod,
  TransactionType,
} from "@prisma/client"

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
  name_fr:       string
  name_ar:       string
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
  measurements: {
    categoryId: string
    value:      string
    unit:       string | null
  }[]
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

// ── Rental creation input (from 7-step wizard) ────────────────
export interface RentalKitItemInput {
  costumeItemId: string
  quantity:      number
}

export interface RentalMeasurementInput {
  categoryId: string
  value:      string
  unit?:      string
}

export interface CreateRentalInput {
  clientId:            string
  eventDate?:          string
  scheduledPickupDate: string
  scheduledReturnDate: string
  totalAmount:         number
  amountPaid:          number
  paymentMethod:       PaymentMethod
  guaranteeType:       GuaranteeType
  guaranteeAmount?:    number
  guaranteePhotoUrl?:  string
  notes?:              string
  kitItems:            RentalKitItemInput[]
  measurements:        RentalMeasurementInput[]
  caisseSessionId:     string
}

export interface AddPaymentInput {
  rentalId:        string
  caisseSessionId: string
  amount:          number
  method:          PaymentMethod
  type:            TransactionType
}

// ── getRentals ─────────────────────────────────────────────────
export async function getRentals(): Promise<RentalForList[]> {
  const rentals = await prisma.rental.findMany({
    include: {
      client: { select: { name: true, phone: true } },
      kit:    { select: { reference: true } },
    },
    orderBy: { createdAt: "desc" },
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
  id: string
): Promise<RentalDetail | null> {
  const r = await prisma.rental.findUnique({
    where:   { id },
    include: {
      client:       { select: { name: true, phone: true } },
      kit: {
        include: {
          items: {
            include: {
              costumeItem: { select: { name_fr: true, name_ar: true } },
            },
          },
        },
      },
      measurements: true,
      payments: {
        include: { recordedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  })
  if (!r) return null

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
    createdAt:           r.createdAt.toISOString(),
    measurements: r.measurements.map((m) => ({
      categoryId: m.categoryId,
      value:      m.value,
      unit:       m.unit,
    })),
    kitItems: (r.kit?.items ?? []).map((ki) => ({
      id:            ki.id,
      costumeItemId: ki.costumeItemId,
      name_fr:       ki.costumeItem.name_fr,
      name_ar:       ki.costumeItem.name_ar,
      quantity:      ki.quantity,
      returned:      ki.returned,
    })),
    payments: r.payments.map((p) => ({
      id:        p.id,
      amount:    p.amount.toString(),
      method:    p.method,
      type:      p.type,
      actorName: p.recordedBy.name,
      createdAt: p.createdAt.toISOString(),
    })),
  }
}

// ── createRental ───────────────────────────────────────────────
export async function createRental(
  input: CreateRentalInput
): Promise<{ rentalId: string }> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")

  const createdById = authSession.user.id
  const balance = Math.round((input.totalAmount - input.amountPaid) * 100) / 100

  // generateKitReference uses a count query — call outside the transaction
  const kitRef = await generateKitReference()

  const result = await prisma.$transaction(async (tx) => {
    // Stock check
    for (const ki of input.kitItems) {
      const item = await tx.costumeItem.findUnique({
        where:  { id: ki.costumeItemId },
        select: { stock: true },
      })
      if (!item) throw new Error(`Article introuvable: ${ki.costumeItemId}`)
      if (item.stock < ki.quantity) {
        throw new Error("Stock insuffisant pour un ou plusieurs articles du kit")
      }
    }

    const rental = await tx.rental.create({
      data: {
        clientId:            input.clientId,
        status:              "booked",
        eventDate:           input.eventDate ? new Date(input.eventDate) : null,
        scheduledPickupDate: new Date(input.scheduledPickupDate),
        scheduledReturnDate: new Date(input.scheduledReturnDate),
        totalAmount:         input.totalAmount,
        amountPaid:          input.amountPaid,
        balance,
        guaranteeType:       input.guaranteeType,
        guaranteeAmount:     input.guaranteeAmount  ?? null,
        guaranteePhotoUrl:   input.guaranteePhotoUrl ?? null,
        notes:               input.notes             ?? null,
        createdById,
        kit: {
          create: {
            reference: kitRef,
            items: {
              create: input.kitItems.map((ki) => ({
                costumeItemId: ki.costumeItemId,
                quantity:      ki.quantity,
              })),
            },
          },
        },
        measurements: {
          create: input.measurements.map((m) => ({
            categoryId: m.categoryId,
            value:      m.value,
            unit:       m.unit ?? null,
          })),
        },
      },
    })

    // Decrement stock for each kit item
    for (const ki of input.kitItems) {
      await tx.costumeItem.update({
        where: { id: ki.costumeItemId },
        data:  { stock: { decrement: ki.quantity } },
      })
    }

    // Record initial payment if amountPaid > 0
    if (input.amountPaid > 0) {
      await tx.rentalPayment.create({
        data: {
          rentalId:        rental.id,
          caisseSessionId: input.caisseSessionId,
          amount:          input.amountPaid,
          method:          input.paymentMethod,
          type:            "rental_payment",
          recordedById:    createdById,
        },
      })
    }

    return rental
  })

  await logActivity({
    portal:     "costumes",
    entityType: "rental",
    entityId:   result.id,
    actorId:    createdById,
    action:     "rental.created",
    diff: {
      clientId:     input.clientId,
      totalAmount:  input.totalAmount,
      amountPaid:   input.amountPaid,
      balance,
      kitItemCount: input.kitItems.length,
    },
  })

  // Pusher notification
  try {
    await createNotification({
      title:  "Nouvelle location",
      body:   `Kit ${kitRef} — ${input.totalAmount} MAD`,
      type:   "rental",
      portal: "costumes",
    })
  } catch { /* non-critical */ }

  // Email — rental confirmation to admin (non-blocking)
  try {
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      const client = await prisma.client.findUnique({
        where:  { id: input.clientId },
        select: { name: true, phone: true },
      })
      if (client) {
        await sendMail(
          adminEmail,
          `Nouvelle location — ${client.name} · ${kitRef}`,
          rentalConfirmationHtml({
            clientName:  client.name,
            clientPhone: client.phone,
            kitRef,
            pickupDate:  new Date(input.scheduledPickupDate).toLocaleDateString("fr-FR"),
            returnDate:  new Date(input.scheduledReturnDate).toLocaleDateString("fr-FR"),
            totalAmount: `${input.totalAmount} MAD`,
            amountPaid:  `${input.amountPaid} MAD`,
            balance:     `${balance} MAD`,
          })
        )
      }
    }
  } catch {
    // Email failure must never break the rental creation
  }

  return { rentalId: result.id }
}

// ── getRentalItems ─────────────────────────────────────────────
export interface CostumeItemForRental {
  id:            string
  name_fr:       string
  name_ar:       string
  typeId:        string
  typeLabelFr:   string
  sizeId:        string | null
  colorId:       string | null
  stock:         number
  refGuidePrice: string | null
  images:        string[]
}

export async function getRentalItems(): Promise<{
  items:      CostumeItemForRental[]
  lookupById: LookupById
}> {
  const [rawItems, rawLookup] = await Promise.all([
    prisma.costumeItem.findMany({
      where:   { isActive: true, stock: { gt: 0 }, segment: "rental" },
      include: { costumeType: true },
      orderBy: { name_fr: "asc" },
    }),
    prisma.lookupValue.findMany({
      where:   { isActive: true },
      include: { category: { select: { slug: true } } },
      orderBy: { order: "asc" },
    }),
  ])

  const lookupById: LookupById = {}
  for (const lv of rawLookup) {
    lookupById[lv.id] = { label_fr: lv.label_fr, label_ar: lv.label_ar }
  }

  return {
    items: rawItems.map((i) => ({
      id:            i.id,
      name_fr:       i.name_fr,
      name_ar:       i.name_ar,
      typeId:        i.typeId,
      typeLabelFr:   i.costumeType.label_fr,
      sizeId:        i.sizeId,
      colorId:       i.colorId,
      stock:         i.stock,
      refGuidePrice: i.refGuidePrice?.toString() ?? null,
      images:        i.images,
    })),
    lookupById,
  }
}

// ── getRentalLookups ───────────────────────────────────────────
// Returns measurement category lookup values for the rental wizard Step 4.
import type { LookupItem, LookupById } from "./pos"

export async function getRentalLookups(): Promise<{
  measurementCategories: LookupItem[]
}> {
  const rawLookup = await prisma.lookupValue.findMany({
    where:   { isActive: true },
    include: { category: { select: { slug: true } } },
    orderBy: { order: "asc" },
  })

  const measurementCategories = rawLookup
    .filter((lv) => lv.category.slug === "measurement_categories")
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  return { measurementCategories }
}

// ── advanceRentalStatus ────────────────────────────────────────
const STATUS_FLOW: Record<RentalStatus, RentalStatus | null> = {
  booked:           "in_preparation",
  in_preparation:   "ready_for_pickup",
  ready_for_pickup: "picked_up",
  picked_up:        "returned",
  returned:         "cleaning",
  cleaning:         "available",
  available:        null,
}

export async function advanceRentalStatus(
  rentalId: string
): Promise<{ newStatus: RentalStatus }> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")

  const rental = await prisma.rental.findUniqueOrThrow({
    where:  { id: rentalId },
    select: {
      status: true,
      kit: {
        include: {
          items: { select: { costumeItemId: true, quantity: true } },
        },
      },
    },
  })

  const nextStatus = STATUS_FLOW[rental.status]
  if (!nextStatus) throw new Error("Location déjà clôturée")

  await prisma.$transaction(async (tx) => {
    await tx.rental.update({
      where: { id: rentalId },
      data: {
        status:           nextStatus,
        actualPickupDate: nextStatus === "picked_up" ? new Date() : undefined,
        actualReturnDate: nextStatus === "cleaning"  ? new Date() : undefined,
      },
    })

    // Restore stock when rental reaches available
    if (nextStatus === "available" && rental.kit) {
      for (const ki of rental.kit.items) {
        await tx.costumeItem.update({
          where: { id: ki.costumeItemId },
          data:  { stock: { increment: ki.quantity } },
        })
      }
    }
  })

  await logActivity({
    portal:     "costumes",
    entityType: "rental",
    entityId:   rentalId,
    actorId:    authSession.user.id,
    action:     "rental.status_changed",
    diff:       { from: rental.status, to: nextStatus },
  })

  return { newStatus: nextStatus }
}

// ── addRentalPayment ───────────────────────────────────────────
export async function addRentalPayment(
  input: AddPaymentInput
): Promise<void> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")

  const rental = await prisma.rental.findUniqueOrThrow({
    where:  { id: input.rentalId },
    select: {
      amountPaid:      true,
      totalAmount:     true,
      depositApplied:  true,
      depositReturned: true,
    },
  })

  const isDepositReturn = input.type === "deposit_returned"
  const isDeposit       = input.type === "deposit_collected"

  // deposit_returned does not count toward amountPaid — it is a caisse outflow only
  const newAmountPaid = isDepositReturn
    ? Number(rental.amountPaid)
    : Math.round((Number(rental.amountPaid) + input.amount) * 100) / 100

  const newBalance = Math.round((Number(rental.totalAmount) - newAmountPaid) * 100) / 100

  await prisma.$transaction(async (tx) => {
    await tx.rentalPayment.create({
      data: {
        rentalId:        input.rentalId,
        caisseSessionId: input.caisseSessionId,
        amount:          input.amount,
        method:          input.method,
        type:            input.type,
        recordedById:    authSession.user.id,
      },
    })

    await tx.rental.update({
      where: { id: input.rentalId },
      data: {
        amountPaid:      newAmountPaid,
        balance:         newBalance,
        depositApplied:  isDeposit       ? true : rental.depositApplied,
        depositReturned: isDepositReturn ? true : rental.depositReturned,
      },
    })
  })

  await logActivity({
    portal:     "costumes",
    entityType: "rental_payment",
    entityId:   input.rentalId,
    actorId:    authSession.user.id,
    action:     "rental.payment_added",
    diff:       { amount: input.amount, type: input.type, method: input.method },
  })
}