import bcrypt from "bcryptjs"

const PEPPER = process.env.PIN_HASH_PEPPER ?? ""
const SALT_ROUNDS = 12

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin + PEPPER, SALT_ROUNDS)
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin + PEPPER, hash)
}