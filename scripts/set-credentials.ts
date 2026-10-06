/**
 * Gives an EXISTING user an email + password (used once after the email/password migration, and to
 * recover an account whose password was lost).
 *
 *   npx tsx scripts/set-credentials.ts --name "Amine" --email amine@example.com --password "S0me-long-pass"
 *   npx tsx scripts/set-credentials.ts --id <userId>  --email ...  --password ...  [--role admin|staff]
 *
 * The user is NOT forced to change the password afterwards unless you pass --must-change.
 */
import { createScriptPrisma, parseArgs } from "./_prisma"
import { hashPassword, isValidEmail, normalizeEmail, validatePassword } from "../lib/auth/password"

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { id, name, email: rawEmail, password, role } = args

  if ((!id && !name) || !rawEmail || !password) {
    console.error('Usage: tsx scripts/set-credentials.ts (--id <id> | --name "<name>") --email <email> --password <password> [--role admin|staff] [--must-change]')
    process.exit(1)
  }
  const email = normalizeEmail(rawEmail)
  if (!isValidEmail(email)) throw new Error("Invalid email")
  if (validatePassword(password)) throw new Error("Password too weak (minimum 8 characters)")
  if (role && role !== "admin" && role !== "staff") throw new Error("--role must be admin or staff")

  const prisma = createScriptPrisma()
  try {
    const matches = await prisma.user.findMany({
      where:  id ? { id } : { name },
      select: { id: true, name: true, role: true },
    })
    if (matches.length === 0) throw new Error("No matching user")
    if (matches.length > 1) throw new Error(`${matches.length} users match, pass --id instead`)
    const user = matches[0]
    if (user.role === "ghost") throw new Error("Use scripts/create-ghost.ts for the ghost account")

    await prisma.user.update({
      where: { id: user.id },
      data: {
        email,
        passwordHash:       await hashPassword(password),
        mustChangePassword: args["must-change"] === "true",
        failedLogins:       0,
        lockedUntil:        null,
        isActive:           true,
        ...(role ? { role: role as "admin" | "staff" } : {}),
      },
    })
    console.log(`✓ ${user.name} (${user.id}) can now log in with ${email}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
