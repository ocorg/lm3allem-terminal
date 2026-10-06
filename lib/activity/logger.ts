import { prisma } from "@/lib/db/prisma"
import { defer } from "@/lib/utils/defer"
import type { Prisma, Portal, Role } from "@prisma/client"

export interface LogActivityInput {
  portal:     Portal
  entityType: string
  entityId:   string
  actor:      { id: string; role: Role | string }
  action:     string
  diff?:      Prisma.InputJsonValue
}

/**
 * Best-effort audit trail:
 *   - never throws (a logging hiccup must not turn a committed sale into an error + retry);
 *   - the ghost account is invisible, so its actions are not logged.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  if (input.actor.role === "ghost") return
  await defer(() => write(input))
}

async function write(input: LogActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        portal:     input.portal,
        entityType: input.entityType,
        entityId:   input.entityId,
        actorId:    input.actor.id,
        action:     input.action,
        diff:       input.diff,
      },
    })
  } catch (err) {
    console.error("[activity] failed to write log:", err)
  }
}
