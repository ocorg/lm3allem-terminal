"use client"

import { useEffect } from "react"

/**
 * Registers the offline service worker (production only: in development it would cache stale code).
 * The worker keeps the app shell and the last visited pages so the till still opens without internet.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.error("[sw] registration failed:", err)
    })
  }, [])

  return null
}

/** Called at logout: forget every cached page (they contain this user's data). Unsent sales are kept. */
export async function clearOfflinePageCache(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    reg?.active?.postMessage({ type: "CLEAR_PAGES" })
    // also drop pages cached by the worker's own cache names, in case the worker is not active
    if ("caches" in window) {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.startsWith("lm3allem-pages")).map((k) => caches.delete(k)))
    }
  } catch {
    /* never block a logout */
  }
}
