"use server"

import { prisma }       from "@/lib/db/prisma"
import { auth }         from "@/lib/auth/auth"
import { logActivity }  from "@/lib/activity/logger"
import type { PaymentMethod } from "@prisma/client"

// ── Shared lookup shape ────────────────────────────
export interface LookupItem {
  id:       string
  label_fr: string
  label_ar: string
}

export type LookupById = Record<string, { label_fr: string; label_ar: string }>

// ── Product shape for POS ──────────────────────────
export interface VariantForPOS {
  id:      string
  sizeId:  string | null
  colorId: string | null
  stock:   number
}

export interface ProductForPOS {
  id:              string
  name_fr:         string
  name_ar:         string
  categoryId:      string
  sellingPrice:    string
  minSellingPrice: string
  images:          string[]
  variants:        VariantForPOS[]
}

// ── Sale input ─────────────────────────────────────
export interface SaleItemInput {
  variantId:      string
  quantity:       number
  unitPrice:      number
  wasBelowMin:    boolean
  authorizedById?: string
}

export interface CreateSaleInput {
  caisseSessionId: string
  items:           SaleItemInput[]
  paymentMethod:   PaymentMethod
  totalAmount:     number
  amountPaid:      number
  isCredit:        boolean
  clientName?:     string
  clientPhone?:    string
}

// ── getProductsForPOS ──────────────────────────────
export interface LookupEntry {
  id:       string
  label_fr: string
  label_ar: string
  slug:     string
}

export async function getProductsForPOS(): Promise<{
  products:   ProductForPOS[]
  categories: LookupItem[]
  lookupById: LookupById
}> {
  const [rawProducts, rawLookup] = await Promise.all([
    prisma.product.findMany({
      where:   { isActive: true },
      select: {
        id:              true,
        name_fr:         true,
        name_ar:         true,
        categoryId:      true,
        sellingPrice:    true,
        minSellingPrice: true,
        images:          true,
        variants:        {
          select: { id: true, sizeId: true, colorId: true, stock: true },
        },
      },
      orderBy: { name_fr: "asc" },
    }),
    prisma.lookupValue.findMany({
      where:   { isActive: true },
      include: { category: { select: { slug: true } } },
      orderBy: { order: "asc" },
    }),
  ])

  const categories: LookupItem[] = rawLookup
    .filter((lv) => lv.category.slug === "product_categories")
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  const lookupById: LookupById = {}
  for (const lv of rawLookup) {
    lookupById[lv.id] = { label_fr: lv.label_fr, label_ar: lv.label_ar }
  }

  const products: ProductForPOS[] = rawProducts.map((p) => ({
    ...p,
    sellingPrice:    p.sellingPrice.toString(),
    minSellingPrice: p.minSellingPrice.toString(),
  }))

  return { products, categories, lookupById }
}

// ── createSale ─────────────────────────────────────
export async function createSale(
  input: CreateSaleInput
): Promise<{ saleId: string }> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")

  const cashierId = authSession.user.id

  const result = await prisma.$transaction(async (tx) => {
    // Stock check inside transaction (avoids race conditions)
    for (const item of input.items) {
      const variant = await tx.productVariant.findUnique({
        where:  { id: item.variantId },
        select: { stock: true },
      })
      if (!variant) throw new Error(`Variante introuvable: ${item.variantId}`)
      if (variant.stock < item.quantity) {
        throw new Error("Stock insuffisant pour un ou plusieurs articles")
      }
    }

    // Create Sale
    const sale = await tx.sale.create({
      data: {
        cashierId,
        caisseSessionId: input.caisseSessionId,
        totalAmount:     input.totalAmount,
        amountPaid:      input.amountPaid,
        paymentMethod:   input.paymentMethod,
        isCredit:        input.isCredit,
        items: {
          create: input.items.map((item) => ({
            variantId:      item.variantId,
            quantity:       item.quantity,
            unitPrice:      item.unitPrice,
            wasBelowMin:    item.wasBelowMin,
            authorizedById: item.authorizedById ?? null,
          })),
        },
      },
    })

    // Decrement stock for each variant
    for (const item of input.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data:  { stock: { decrement: item.quantity } },
      })
    }

    // Create Credit record if credit sale
    if (input.isCredit) {
      const balance = Math.round((input.totalAmount - input.amountPaid) * 100) / 100
      await tx.credit.create({
        data: {
          saleId:      sale.id,
          clientName:  input.clientName ?? "Client",
          clientPhone: input.clientPhone ?? null,
          totalAmount: input.totalAmount,
          amountPaid:  input.amountPaid,
          balance,
          status:      balance <= 0 ? "settled" : "open",
        },
      })
    }

    return sale
  })

  await logActivity({
    portal:     "magazin",
    entityType: "sale",
    entityId:   result.id,
    actorId:    cashierId,
    action:     "sale.created",
    diff: {
      totalAmount:  input.totalAmount,
      amountPaid:   input.amountPaid,
      itemCount:    input.items.length,
      isCredit:     input.isCredit,
      paymentMethod: input.paymentMethod,
    },
  })

  return { saleId: result.id }
}