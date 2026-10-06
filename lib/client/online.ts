"use client"

import { useSyncExternalStore } from "react"

function subscribe(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

/** Live connection state (true on the server so the first render matches). */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}

/** True when an error looks like "the network is down / the request never reached the server". */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true
  if (err instanceof DOMException && (err.name === "AbortError" || err.name === "TimeoutError")) return true
  if (err instanceof TypeError) return /fetch|network|load failed|failed to/i.test(err.message)
  return false
}
