import type { Role } from "@prisma/client"

/** What is shown wherever a ghost user would otherwise appear as the author of a record. */
export const GHOST_DISPLAY_NAME = "الإدارة"

export function actorLabel(actor: { name: string; role?: Role | string | null } | null | undefined): string {
  if (!actor) return "-"
  return actor.role === "ghost" ? GHOST_DISPLAY_NAME : actor.name
}
