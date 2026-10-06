"use server"

import { prisma } from "@/lib/db/prisma"
import { invalidateLookups } from "@/lib/queries/lookups"
import { requireAdmin, requireUser } from "@/lib/auth/guard"
import { logActivity } from "@/lib/activity/logger"
import { canAccessModule, isAdminRole } from "@/lib/permissions"
import { ActionError, run, type ActionResult } from "@/lib/actions/result"
import { asId } from "@/lib/validation"

/** Lookup lists that the UI is allowed to extend through the "+ add new" dropdown. */
const EXTENDABLE_SLUGS = [
  "product_categories", "product_sizes", "product_colors",
  "suit_sizes", "pants_sizes", "shirt_sizes", "shoe_sizes",
  "costume_item_types", "expense_categories",
] as const

export async function createLookupBySlug(
  slug: string,
  labelAr: string
): Promise<ActionResult<{ id: string; label_ar: string }>> {
  return run(async () => {
    const user = await requireUser()
    if (!(EXTENDABLE_SLUGS as readonly string[]).includes(slug)) throw new ActionError("validation")

    // Admins may extend any list; staff only the product-category list used by "product requests".
    const allowed =
      isAdminRole(user.role) ||
      (slug === "product_categories" && canAccessModule(user, "magazin", "requests"))
    if (!allowed) throw new ActionError("forbidden")

    const label = typeof labelAr === "string" ? labelAr.trim() : ""
    if (!label || label.length > 120) throw new ActionError("validation", "الاسم مطلوب")

    const cat = await prisma.lookupCategory.findUnique({ where: { slug } })
    if (!cat) throw new ActionError("not_found")

    const normalized = label.toLowerCase()
    const existing = await prisma.lookupValue.findMany({ where: { categoryId: cat.id } })
    const match = existing.find((v) =>
      v.label_ar.trim().toLowerCase() === normalized || v.label_fr.trim().toLowerCase() === normalized
    )

    if (match) {
      if (match.isActive) throw new ActionError("option_exists")
      // Was previously removed - bring it back instead of creating a duplicate row
      const revived = await prisma.lookupValue.update({ where: { id: match.id }, data: { isActive: true } })
      invalidateLookups()
      return { id: revived.id, label_ar: revived.label_ar }
    }

    const max = await prisma.lookupValue.aggregate({ where: { categoryId: cat.id }, _max: { order: true } })
    const created = await prisma.lookupValue.create({
      data: {
        categoryId: cat.id,
        label_fr:   label,
        label_ar:   label,
        order:      (max._max.order ?? 0) + 1,
        isActive:   true,
      },
    })

    invalidateLookups()

    await logActivity({
      portal: "lm3allem", entityType: "lookup_value", entityId: created.id, actor: user,
      action: "lookup_value.created", diff: { slug, label },
    })

    return { id: created.id, label_ar: created.label_ar }
  })
}

/** Soft-removes an option (it disappears from dropdowns; records that already use it keep working). */
export async function removeLookupValue(valueId: string): Promise<ActionResult> {
  valueId = asId(valueId)
  return run(async () => {
    const user = await requireAdmin()
    const value = await prisma.lookupValue.findUnique({ where: { id: valueId }, select: { id: true } })
    if (!value) throw new ActionError("not_found")

    await prisma.lookupValue.update({ where: { id: valueId }, data: { isActive: false } })
    invalidateLookups()

    await logActivity({
      portal: "lm3allem", entityType: "lookup_value", entityId: valueId, actor: user,
      action: "lookup_value.deactivated",
    })
  })
}
