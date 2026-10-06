import { toast } from "@/hooks/useToast"

/**
 * Copies text and ALWAYS tells the user what happened (success or failure).
 * Use this for every "copy" button in the app.
 */
export async function copyText(text: string, what = "النص"): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      // Older browsers / non-secure pages
      const area = document.createElement("textarea")
      area.value = text
      area.setAttribute("readonly", "")
      area.style.position = "fixed"
      area.style.opacity = "0"
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand("copy")
      document.body.removeChild(area)
      if (!ok) throw new Error("copy failed")
    }
    toast(`تم نسخ ${what} إلى الحافظة`, "success")
    return true
  } catch {
    toast(`تعذر النسخ تلقائيا. حدد ${what} يدويا ثم انسخه`, "error")
    return false
  }
}
