/*
 * Lm3allem Terminal - offline service worker.
 *
 *  - Static files (JS, CSS, fonts, icons): cache-first, so the app opens instantly and without internet.
 *  - Pages (HTML + Next.js data): network-first with a short timeout; when the network is down or very
 *    slow, the last copy of that page is shown instead (so the till still opens).
 *  - Never touched: /api/* (login, uploads, private files, push), anything that is not a GET.
 *
 * Cached pages contain business data, so the app asks this worker to forget them at logout.
 */
const VERSION = "v1"
const STATIC_CACHE = `lm3allem-static-${VERSION}`
const PAGES_CACHE = `lm3allem-pages-${VERSION}`
const OFFLINE_URL = "/offline.html"
const NETWORK_TIMEOUT_MS = 7000

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"]))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith("lm3allem-") && k !== STATIC_CACHE && k !== PAGES_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_PAGES") {
    event.waitUntil(caches.delete(PAGES_CACHE))
  }
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  )
}

/** One cache key per page path (the random ?_rsc=... suffix of Next.js data requests is ignored). */
function pageKey(url, isData) {
  return `${url.origin}${url.pathname}${isData ? "?__data" : ""}`
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms)
    promise.then((r) => { clearTimeout(timer); resolve(r) }, (e) => { clearTimeout(timer); reject(e) })
  })
}

async function networkFirst(request, url, isNavigation) {
  const cache = await caches.open(PAGES_CACHE)
  const key = pageKey(url, !isNavigation)

  const networkPromise = fetch(request).then((response) => {
    // only real, successful, non-redirected pages are stored (a redirect to the login page must never be cached)
    if (response.ok && !response.redirected && response.type === "basic") {
      cache.put(key, response.clone())
    }
    return response
  })

  try {
    return await withTimeout(networkPromise, NETWORK_TIMEOUT_MS)
  } catch (err) {
    const cached = await cache.match(key, { ignoreVary: true })
    if (cached) {
      // slow (not dead) network: let the real response refresh the cache for next time
      networkPromise.catch(() => {})
      return cached
    }
    // nothing cached: a slow network is still better than no page
    if (err && err.message === "timeout") {
      try { return await networkPromise } catch (e) { /* fall through */ }
    }
    if (isNavigation) {
      const offline = await (await caches.open(STATIC_CACHE)).match(OFFLINE_URL)
      if (offline) return offline
    }
    return Response.error()
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request))
    return
  }

  // X-Warm: background pre-load made by the app after login (stored exactly like a page visit)
  const isNavigation = request.mode === "navigate" || request.headers.get("X-Warm") === "1"
  const isData = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")
  if (isNavigation || isData) {
    event.respondWith(networkFirst(request, url, isNavigation))
  }
})
