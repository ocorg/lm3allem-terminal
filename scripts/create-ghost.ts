/**
 * Creates (or resets the password of) the GHOST account: full permissions, invisible to every
 * screen (user list, activity log, active-user counts, notifications) and not editable from the UI.
 * It can only be created here, never from the application.
 *
 *   npx tsx scripts/create-ghost.ts --list
 *   npx tsx scripts/create-ghost.ts --email ghost@example.com --password "A-long-random-password"
 *   npx tsx scripts/create-ghost.ts --convert "Tech Support" --email ghost@example.com --password "..."
 *
 * --convert promotes an EXISTING user row (by --convert <name|id>) to ghost, so everything that
 * person already did (sales, logs, caisse sessions) is shown as "الإدارة" from now on instead of
 * leaving a visible, orphaned user behind.
 */
import { createScriptPrisma, parseArgs } from "./_prisma"
import { hashPassword, isValidEmail, normalizeEmail, validatePassword } from "../lib/auth/password"

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const prisma = createScriptPrisma()

  try {
    if (args.list) {
      const users = await prisma.user.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, role: true, email: true, isActive: true },
      })
      console.table(users)
      return
    }

    const { email: rawEmail, password, name = "Ghost", convert } = args
    if (!rawEmail || !password) {
      console.error('Usage: tsx scripts/create-ghost.ts [--convert "<name|id>"] --email <email> --password <password> [--name <name>]')
      console.error("       tsx scripts/create-ghost.ts --list")
      process.exit(1)
    }
    const email = normalizeEmail(rawEmail)
    if (!isValidEmail(email)) throw new Error("Invalid email")
    if (validatePassword(password)) throw new Error("Password too weak (minimum 8 characters)")

    const passwordHash = await hashPassword(password)
    const emailOwner = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })

    if (convert) {
      const matches = await prisma.user.findMany({
        where:  { OR: [{ id: convert }, { name: convert }] },
        select: { id: true, name: true, role: true },
      })
      if (matches.length === 0) throw new Error(`No user matches "${convert}" (run with --list)`)
      if (matches.length > 1) throw new Error(`${matches.length} users match "${convert}": pass the id (run with --list)`)
      const target = matches[0]
      if (emailOwner && emailOwner.id !== target.id) throw new Error("That email already belongs to another user")

      await prisma.user.update({
        where: { id: target.id },
        data: {
          role: "ghost", email, passwordHash, isActive: true,
          mustChangePassword: false, failedLogins: 0, lockedUntil: null,
          portalAccess: ["magazin", "costumes", "lm3allem"],
          modulePermissions: {},
        },
      })
      console.log(`✓ "${target.name}" (was ${target.role}) is now the ghost account: ${email}`)
      return
    }

    if (emailOwner && emailOwner.role !== "ghost") throw new Error("That email belongs to a normal user")

    if (emailOwner) {
      await prisma.user.update({
        where: { id: emailOwner.id },
        data:  { passwordHash, mustChangePassword: false, failedLogins: 0, lockedUntil: null, isActive: true },
      })
      console.log(`✓ ghost password reset for ${email}`)
    } else {
      await prisma.user.create({
        data: {
          name, email, passwordHash, role: "ghost", isActive: true,
          portalAccess: ["magazin", "costumes", "lm3allem"],
          modulePermissions: {},
          mustChangePassword: false,
        },
      })
      console.log(`✓ ghost account created: ${email}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
