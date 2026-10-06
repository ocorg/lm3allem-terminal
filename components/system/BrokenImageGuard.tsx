"use client"

import { useEffect } from "react"

/**
 * A picture that cannot be loaded (deleted file, no connection) is hidden instead of showing
 * the browser's broken-image icon with its text spilling over the card.
 */
export function BrokenImageGuard() {
  useEffect(() => {
    const hide = (img: HTMLImageElement) => { img.style.opacity = "0" }
    const onError = (e: Event) => { if (e.target instanceof HTMLImageElement) hide(e.target) }
    // "error" does not bubble: listen in the capture phase to catch every image on the page
    document.addEventListener("error", onError, true)
    // images that already failed before this code started
    document.querySelectorAll("img").forEach((img) => { if (img.complete && img.naturalWidth === 0 && img.src) hide(img) })
    return () => document.removeEventListener("error", onError, true)
  }, [])
  return null
}
