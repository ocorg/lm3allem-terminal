import { prisma } from "@/lib/db/prisma"

export interface MaintenanceStatus {
  isActive: boolean
  message_fr: string
  message_ar: string
}

const FALLBACK_FR = "Le système est temporairement indisponible. Réessayez plus tard."
const FALLBACK_AR = "النظام غير متاح مؤقتاً. يرجى المحاولة لاحقاً."

export async function checkMaintenanceMode(): Promise<MaintenanceStatus> {
  try {
    const settings = await prisma.systemSettings.findFirst({
      select: {
        maintenanceMode: true,
        maintenanceMessage_fr: true,
        maintenanceMessage_ar: true,
      },
    })

    return {
      isActive: settings?.maintenanceMode ?? false,
      message_fr: settings?.maintenanceMessage_fr ?? FALLBACK_FR,
      message_ar: settings?.maintenanceMessage_ar ?? FALLBACK_AR,
    }
  } catch {
    // DB unreachable — fail open (never lock everyone out)
    return {
      isActive: false,
      message_fr: FALLBACK_FR,
      message_ar: FALLBACK_AR,
    }
  }
}