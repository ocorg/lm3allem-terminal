import type { Prisma, PrismaClient } from "@prisma/client"

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Atomic sequence: the upsert increment is a single SQL statement, so concurrent callers
 * always receive distinct values (unlike `count() + 1`).
 */
export async function nextSequence(db: Tx, key: string): Promise<number> {
  const row = await db.counter.upsert({
    where:  { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  })
  return row.value
}

export async function nextKitReference(db: Tx): Promise<string> {
  const n = await nextSequence(db, "rental_kit")
  return `KIT-${String(n).padStart(4, "0")}`
}

export async function nextItemSku(db: Tx): Promise<string> {
  const n = await nextSequence(db, "costume_item")
  return `ART-${String(n).padStart(4, "0")}`
}
