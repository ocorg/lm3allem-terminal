"use server"

import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { getActiveLookups } from "@/lib/queries/lookups"
import { requireAdmin, requireModule } from "@/lib/auth/guard"
import { logActivity } from "@/lib/activity/logger"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { id, money, parseInput, asId } from "@/lib/validation"
import type { LookupItem, LookupById } from "./pos"

// ── Shapes ─────────────────────────────────────────
export interface VariantForInventory {
  id:      string
  sizeId:  string | null
  colorId: string | null
  stock:   number
}

export interface ProductForInventory {
  id:              string
  name_fr:         string
  name_ar:         string
  categoryId:      string
  buyingPrice:     string
  sellingPrice:    string
  minSellingPrice: string
  images:          string[]
  isActive:        boolean
  createdAt:       string
  totalStock:      number
  variants:        VariantForInventory[]
}

export interface VariantInput {
  id?:           string    // present when editing an existing variant
  sizeId:        string | null
  colorId:       string | null
  stock:         number
  /** stock the form was loaded with: the save applies the DIFFERENCE, so sales made meanwhile are kept */
  originalStock?: number
}

export interface ProductInput {
  name_fr:         string
  name_ar:         string
  categoryId:      string
  buyingPrice:     number
  sellingPrice:    number
  minSellingPrice: number
  images:          string[]
  variants:        VariantInput[]
}

const imageUrl = z.string().max(600).refine(
  (u) => /^https:\/\//.test(u) || u.startsWith("/api/files/"),
  { message: "invalid image" }
)

const productSchema = z.object({
  name_fr:         z.string().trim().min(1).max(200),
  name_ar:         z.string().trim().min(1).max(200),
  categoryId:      id,
  buyingPrice:     money,
  sellingPrice:    money,
  minSellingPrice: money,
  images:          z.array(imageUrl).max(12),
  variants: z.array(z.object({
    id:            id.optional(),
    sizeId:        id.nullable(),
    colorId:       id.nullable(),
    stock:         z.number().int().min(0).max(1_000_000),
    originalStock: z.number().int().min(0).max(1_000_000).optional(),
  })).min(1).max(100),
}).refine((p) => p.minSellingPrice <= p.sellingPrice, { message: "min price above selling price" })

function assertNoDuplicateVariants(variants: { sizeId: string | null; colorId: string | null }[]) {
  const seen = new Set<string>()
  for (const v of variants) {
    const key = `${v.sizeId ?? ""}|${v.colorId ?? ""}`
    if (seen.has(key)) throw new ActionError("validation", "يوجد نوعان بنفس المقاس واللون")
    seen.add(key)
  }
}

async function assertProductCategory(categoryId: string) {
  const ok = await prisma.lookupValue.findFirst({
    where:  { id: categoryId, category: { slug: "product_categories" } },
    select: { id: true },
  })
  if (!ok) throw new ActionError("validation", "فئة المنتج غير صالحة")
}

// ── getInventory ───────────────────────────────────
export interface LookupEntry {
  id:       string
  label_fr: string
  label_ar: string
  slug:     string
}

export async function getInventory(): Promise<ProductForInventory[]> {
  await requireModule("magazin", "inventory")

  const products = await prisma.product.findMany({
    include: { variants: true },
    orderBy: { createdAt: "desc" },
  })

  return products.map((p) => ({
    id:              p.id,
    name_fr:         p.name_fr,
    name_ar:         p.name_ar,
    categoryId:      p.categoryId,
    buyingPrice:     p.buyingPrice.toString(),
    sellingPrice:    p.sellingPrice.toString(),
    minSellingPrice: p.minSellingPrice.toString(),
    images:          p.images,
    isActive:        p.isActive,
    createdAt:       p.createdAt.toISOString(),
    totalStock:      p.variants.reduce((s, v) => s + v.stock, 0),
    variants:        p.variants.map((v) => ({
      id:      v.id,
      sizeId:  v.sizeId,
      colorId: v.colorId,
      stock:   v.stock,
    })),
  }))
}

// ── getLookupValuesForInventory ────────────────────
export async function getLookupValuesForInventory(): Promise<{
  categories: LookupItem[]
  lookupById: LookupById
}> {
  await requireModule("magazin", "inventory")

  const rawLookup = await getActiveLookups()

  const categories = rawLookup
    .filter((lv) => lv.category.slug === "product_categories")
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  const lookupById: LookupById = {}
  for (const lv of rawLookup) {
    lookupById[lv.id] = { label_fr: lv.label_fr, label_ar: lv.label_ar }
  }

  return { categories, lookupById }
}

// ── getSizesAndColors ──────────────────────────────
export async function getSizesAndColors(): Promise<{
  sizes:  LookupItem[]
  colors: LookupItem[]
}> {
  await requireModule("magazin", "inventory")

  const rawLookup = await getActiveLookups()

  const pick = (slug: string) => rawLookup
    .filter((lv) => lv.category.slug === slug)
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  return { sizes: pick("product_sizes"), colors: pick("product_colors") }
}

// ── createProduct ──────────────────────────────────
export async function createProduct(
  rawInput: ProductInput
): Promise<ActionResult<{ productId: string }>> {
  return run(async () => {
    const user  = await requireAdmin()
    const input = parseInput(productSchema, rawInput)
    assertNoDuplicateVariants(input.variants)
    await assertProductCategory(input.categoryId)

    const product = await prisma.product.create({
      data: {
        name_fr:         input.name_fr,
        name_ar:         input.name_ar,
        categoryId:      input.categoryId,
        buyingPrice:     input.buyingPrice,
        sellingPrice:    input.sellingPrice,
        minSellingPrice: input.minSellingPrice,
        images:          input.images,
        variants: {
          create: input.variants.map((v) => ({
            sizeId:  v.sizeId,
            colorId: v.colorId,
            stock:   v.stock,
          })),
        },
      },
    })

    await logActivity({
      portal: "magazin", entityType: "product", entityId: product.id, actor: user,
      action: "product.created", diff: { name_fr: input.name_fr, sellingPrice: input.sellingPrice },
    })

    return { productId: product.id }
  })
}

// ── updateProduct ──────────────────────────────────
export async function updateProduct(
  productId: string,
  rawInput:  ProductInput
): Promise<ActionResult> {
  return run(async () => {
    const user  = await requireAdmin()
    const input = parseInput(productSchema, rawInput)
    assertNoDuplicateVariants(input.variants)
    await assertProductCategory(input.categoryId)

    await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id: productId }, select: { id: true } })
      if (!existing) throw new ActionError("not_found")

      await tx.product.update({
        where: { id: productId },
        data: {
          name_fr:         input.name_fr,
          name_ar:         input.name_ar,
          categoryId:      input.categoryId,
          buyingPrice:     input.buyingPrice,
          sellingPrice:    input.sellingPrice,
          minSellingPrice: input.minSellingPrice,
          images:          input.images,
        },
      })

      // Variants are never deleted (SaleItem keeps referencing them): "removing" one zeroes its stock.
      for (const v of input.variants) {
        if (v.id) {
          const own = await tx.productVariant.findFirst({
            where: { id: v.id, productId }, select: { stock: true },
          })
          if (!own) throw new ActionError("not_found")

          // Apply the DIFFERENCE against the stock the form was loaded with, so a sale made while
          // the modal was open is not silently overwritten by a stale absolute value.
          const delta = v.stock - (v.originalStock ?? own.stock)
          if (delta < 0) {
            const res = await tx.productVariant.updateMany({
              where: { id: v.id, stock: { gte: -delta } },
              data:  { sizeId: v.sizeId, colorId: v.colorId, stock: { decrement: -delta } },
            })
            if (res.count !== 1) throw new ActionError("insufficient_stock")
          } else {
            await tx.productVariant.update({
              where: { id: v.id },
              data:  { sizeId: v.sizeId, colorId: v.colorId, stock: { increment: delta } },
            })
          }
        } else {
          await tx.productVariant.create({
            data: { productId, sizeId: v.sizeId, colorId: v.colorId, stock: v.stock },
          })
        }
      }
    })

    await logActivity({
      portal: "magazin", entityType: "product", entityId: productId, actor: user,
      action: "product.updated", diff: { name_fr: input.name_fr },
    })
  })
}

// ── toggleProductActive ────────────────────────────
export async function toggleProductActive(productId: string): Promise<ActionResult> {
  productId = asId(productId)
  return run(async () => {
    const user = await requireAdmin()

    const product = await prisma.product.findUnique({
      where:  { id: productId },
      select: { isActive: true },
    })
    if (!product) throw new ActionError("not_found")

    await prisma.product.update({
      where: { id: productId },
      data:  { isActive: !product.isActive },
    })

    await logActivity({
      portal: "magazin", entityType: "product", entityId: productId, actor: user,
      action: product.isActive ? "product.deactivated" : "product.activated",
    })
  })
}
