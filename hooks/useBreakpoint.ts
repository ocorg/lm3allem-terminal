"use client"
import { useSyncExternalStore } from "react"

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange)
  return () => window.removeEventListener("resize", onChange)
}

/** Width assumed while the page is still the server's HTML (it cannot know the screen size). */
const SERVER_WIDTH = 1280

/**
 * Screen-size flags. The first render always matches what the server sent (desktop), then switches
 * to the real width: reading window.innerWidth straight away made phones crash the page on load.
 */
export function useBreakpoint() {
  const width = useSyncExternalStore(subscribe, () => window.innerWidth, () => SERVER_WIDTH)

  return {
    isMobile:  width < 768,
    isTablet:  width >= 768 && width < 1024,
    isDesktop: width >= 1024,
  }
}
