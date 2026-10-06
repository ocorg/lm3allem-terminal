"use client"

import { useEffect } from "react"

/**
 * Once the user is logged in and the page has settled, quietly opens the till pages in the background.
 * This (1) lets the offline service worker keep a copy so the till works without internet even if it
 * was never opened on this device, and (2) warms the server so the first real click is fast.
 * Runs at most once every 30 minutes per browser tab.
 */
export default function OfflineWarmup({ urls }: { urls: string[] }) {
  useEffect(() => {
    if (!urls.length || !navigator.onLine) return
    const KEY = "lm3allem-warmup"
    try {
      const last = Number(sessionStorage.getItem(KEY) ?? 0)
      if (Date.now() - last < 30 * 60_000) return
      sessionStorage.setItem(KEY, String(Date.now()))
    } catch { /* private mode: warm up anyway */ }

    const id = setTimeout(() => {
      for (const url of urls) {
        // The marker header tells the service worker to store this response like a normal page visit
        fetch(url, { credentials: "same-origin", headers: { "X-Warm": "1" } }).catch(() => {})
      }
    }, 4000)
    return () => clearTimeout(id)
  }, [urls])

  return null
}
