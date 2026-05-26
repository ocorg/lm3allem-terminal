"use server"

import { prisma }       from "@/lib/db/prisma"
import { auth }         from "@/lib/auth/auth"
import { logActivity }  from "@/lib/activity/logger"
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
  id?:     string    // present when editing an existing variant
  sizeId:  string | null
  colorId: string | null
  stock:   number
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

// ── getInventory ───────────────────────────────────
export interface LookupEntry {
  id:       string
  label_fr: string
  label_ar: string
  slug:     string
}

export async function getInventory(): Promise<ProductForInventory[]> {
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
  const rawLookup = await prisma.lookupValue.findMany({
    where:   { isActive: true },
    include: { category: { select: { slug: true } } },
    orderBy: { order: "asc" },
  })

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
  const rawLookup = await prisma.lookupValue.findMany({
    where:   { isActive: true },
    include: { category: { select: { slug: true } } },
    orderBy: { order: "asc" },
  })

  const sizes  = rawLookup
    .filter((lv) => lv.category.slug.endsWith("_sizes"))
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  const colors = rawLookup
    .filter((lv) => lv.category.slug.endsWith("_colors"))
    .map(({ id, label_fr, label_ar }) => ({ id, label_fr, label_ar }))

  return { sizes, colors }
}

// ── createProduct ──────────────────────────────────
export async function createProduct(
  input: ProductInput
): Promise<{ productId: string }> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")
  if (!["admin", "superadmin"].includes(authSession.user.role)) {
    throw new Error("Forbidden")
  }

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
    portal:     "magazin",
    entityType: "product",
    entityId:   product.id,
    actorId:    authSession.user.id,
    action:     "product.created",
    diff:       { name_fr: input.name_fr, sellingPrice: input.sellingPrice },
  })

  return { productId: product.id }
}

// ── updateProduct ──────────────────────────────────
export async function updateProduct(
  id:    string,
  input: ProductInput
): Promise<void> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")
  if (!["admin", "superadmin"].includes(authSession.user.role)) {
    throw new Error("Forbidden")
  }

  await prisma.$transaction(async (tx) => {
    // Update product fields
    await tx.product.update({
      where: { id },
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

    // Upsert variants:
    // - existing (has id) → update stock + size + color
    // - new (no id) → create
    // Never delete variants (referential integrity with SaleItem)
    for (const v of input.variants) {
      if (v.id) {
        await tx.productVariant.update({
          where: { id: v.id },
          data:  { sizeId: v.sizeId, colorId: v.colorId, stock: v.stock },
        })
      } else {
        await tx.productVariant.create({
          data: { productId: id, sizeId: v.sizeId, colorId: v.colorId, stock: v.stock },
        })
      }
    }
  })

  await logActivity({
    portal:     "magazin",
    entityType: "product",
    entityId:   id,
    actorId:    authSession.user.id,
    action:     "product.updated",
    diff:       { name_fr: input.name_fr },
  })
}

// ── toggleProductActive ────────────────────────────
export async function toggleProductActive(id: string): Promise<void> {
  const authSession = await auth()
  if (!authSession?.user) throw new Error("Unauthorized")
  if (!["admin", "superadmin"].includes(authSession.user.role)) {
    throw new Error("Forbidden")
  }

  const product = await prisma.product.findUniqueOrThrow({
    where:  { id },
    select: { isActive: true },
  })

  await prisma.product.update({
    where: { id },
    data:  { isActive: !product.isActive },
  })

  await logActivity({
    portal:     "magazin",
    entityType: "product",
    entityId:   id,
    actorId:    authSession.user.id,
    action:     product.isActive ? "product.deactivated" : "product.activated",
  })
}