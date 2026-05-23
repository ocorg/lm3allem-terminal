import { prisma } from "@/lib/db/prisma"
import { Prisma, type Portal } from "@prisma/client"

export interface LogActivityInput {
  portal:     Portal
  entityType: string
  entityId:   string
  actorId:    string
  action:     string
  diff?:      Prisma.InputJsonValue
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  await prisma.activityLog.create({
    data: {
      portal:     input.portal,
      entityType: input.entityType,
      entityId:   input.entityId,
      actorId:    input.actorId,
      action:     input.action,
      diff:       input.diff,
    },
  })
}