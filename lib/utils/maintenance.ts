import { prisma } from "@/lib/db/prisma"

export interface MaintenanceStatus {
  isActive: boolean
  message_fr: string
  message_ar: string
}

const FALLBACK_FR = "Le système est temporairement indisponible. Réessayez plus tard."
const FALLBACK_AR = "النظام غير متاح مؤقتاً. يرجى المحاولة لاحقاً."

/** Every request and server action asks for this flag, so it is cached for a few seconds. */
const TTL_MS = 10_000
let cached: { at: number; value: MaintenanceStatus } | null = null

export function invalidateMaintenanceCache(): void {
  cached = null
}

export async function checkMaintenanceMode(): Promise<MaintenanceStatus> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value

  try {
    const settings = await prisma.systemSettings.findFirst({
      select: {
        maintenanceMode: true,
        maintenanceMessage_fr: true,
        maintenanceMessage_ar: true,
      },
    })

    const value: MaintenanceStatus = {
      isActive: settings?.maintenanceMode ?? false,
      message_fr: settings?.maintenanceMessage_fr ?? FALLBACK_FR,
      message_ar: settings?.maintenanceMessage_ar ?? FALLBACK_AR,
    }
    cached = { at: Date.now(), value }
    return value
  } catch {
    // DB unreachable - fail open (never lock everyone out)
    return {
      isActive: false,
      message_fr: FALLBACK_FR,
      message_ar: FALLBACK_AR,
    }
  }
}
