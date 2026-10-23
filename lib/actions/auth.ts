"use server"

import { requireUser } from "@/lib/auth/guard"
import { verifyCredentials } from "@/lib/auth/credentials"
import { BELOW_MIN_SCOPE, returnScope, signOverrideToken } from "@/lib/auth/override"
import { isAdminRole } from "@/lib/permissions"
import { run, ActionError, type ActionResult } from "@/lib/actions/result"
import { prisma } from "@/lib/db/prisma"
import { asId } from "@/lib/validation"

/** What the admin is approving. Without it: a sale below the minimum price. */
export type OverridePurpose = { kind: "return"; saleId: string }

/**
 * Manager override (sales below the minimum price, shop returns).
 * The admin types their own email + password; the answer is a short-lived signed token that the
 * sale actions verify server-side. Failed attempts count towards that account's lockout.
 */
export async function requestManagerOverride(
  email: string,
  password: string,
  purpose?: OverridePurpose
): Promise<ActionResult<{ token: string }>> {
  return run(async () => {
    const cashier = await requireUser()
    if (typeof email !== "string" || typeof password !== "string") throw new ActionError("validation")
    if (purpose !== undefined && (typeof purpose !== "object" || purpose === null || purpose.kind !== "return")) throw new ActionError("validation")
    const scope = purpose ? returnScope(asId(purpose.saleId)) : BELOW_MIN_SCOPE

    const result = await verifyCredentials(email, password)
    if (!result.ok) {
      throw new ActionError(result.reason === "locked" ? "account_locked" : "invalid_credentials")
    }
    if (!isAdminRole(result.user.role)) throw new ActionError("forbidden", "هذا الحساب لا يملك صلاحية التفويض")

    // The token stays valid for several items of the same sale
    const exists = await prisma.user.count({ where: { id: result.user.id, isActive: true } })
    if (!exists) throw new ActionError("forbidden")

    return { token: signOverrideToken(result.user.id, cashier.id, scope) }
  })
}
