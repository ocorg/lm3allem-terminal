"use client"

import { useEffect } from "react"
import { toast } from "@/hooks/useToast"

export const SLOW_OPERATION_MESSAGE =
  "العملية تستغرق وقتا أطول من المعتاد، وغالبا يكون الاتصال بالإنترنت ضعيفا. " +
  "انتظر قليلا. إذا لم تنتهِ، أعد تحميل الصفحة (F5) وتأكد من القائمة قبل تكرار العملية حتى لا تُسجَّل مرتين."

/**
 * Shows an explanation (what is happening and what to do) when something keeps loading for too long,
 * instead of leaving the user in front of a spinner that never ends.
 */
export function useSlowLoadingWarning(active: boolean, delayMs = 15_000) {
  useEffect(() => {
    if (!active) return
    const id = setTimeout(() => toast(SLOW_OPERATION_MESSAGE, "error", 15_000), delayMs)
    return () => clearTimeout(id)
  }, [active, delayMs])
}
