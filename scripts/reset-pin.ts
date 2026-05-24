import { PrismaClient } from "@prisma/client"
import { hashPin } from "@/lib/auth/pin"

const prisma = new PrismaClient()

async function main() {
  const NEW_PIN   = "880826"   // ← change to whatever you want
  const TARGET_EMAIL = "oussamachbr@mgmail.com"  // ← or filter by role below

  const hashed = await hashPin(NEW_PIN)

  const updated = await prisma.user.updateMany({
    where: { role: "superadmin" },   // targets all superadmins
    // where: { email: TARGET_EMAIL }, // or target by email
    data:  { pin: hashed },
  })

  console.log(`✓ Updated ${updated.count} user(s)`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })