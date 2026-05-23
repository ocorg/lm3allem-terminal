import { prisma } from "@/lib/db/prisma"

export async function generateKitReference(): Promise<string> {
  const count = await prisma.rentalKit.count()
  return `KIT-${String(count + 1).padStart(4, "0")}`
}