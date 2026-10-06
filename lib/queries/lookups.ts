import { prisma } from "@/lib/db/prisma"

/**
 * The option lists (sizes, colours, categories...) are read by almost every screen and change very
 * rarely, so they are kept in memory for a short time instead of being re-read from the database on
 * every page load. Any change to a list calls invalidateLookups() so the next read is fresh.
 */
export interface ActiveLookup {
  id:       string
  label_fr: string
  label_ar: string
  order:    number
  category: { slug: string }
}

const TTL_MS = 30_000
let cached: { at: number; rows: ActiveLookup[] } | null = null
let inflight: Promise<ActiveLookup[]> | null = null

export function invalidateLookups(): void {
  cached = null
}

export async function getActiveLookups(): Promise<ActiveLookup[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.rows
  // several requests asking at the same moment share ONE query
  inflight ??= prisma.lookupValue
    .findMany({
      where:   { isActive: true },
      select:  { id: true, label_fr: true, label_ar: true, order: true, category: { select: { slug: true } } },
      orderBy: { order: "asc" },
    })
    .then((rows) => { cached = { at: Date.now(), rows }; return rows })
    .finally(() => { inflight = null })
  return inflight
}
