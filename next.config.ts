import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts")

/**
 * What the browser may load. Everything comes from this site, except product photos (Cloudflare
 * R2) and the live notifications (Pusher). Other sites cannot frame the app, and no plugin, foreign
 * script or form target is allowed. ('unsafe-inline' is required by Next.js page scripts and by the
 * inline styles of the interface; scripts from any other origin stay blocked.)
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.r2.dev",
  "font-src 'self' data:",
  "connect-src 'self' https://*.pusher.com wss://*.pusher.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
]

const nextConfig: NextConfig = {
  // this folder is the project root (another lockfile higher up on the disk must not confuse the build)
  outputFileTracingRoot: __dirname,
  // The Arabic font used to draw table pictures for Telegram must ship with the server build
  outputFileTracingIncludes: {
    "/*": ["./assets/fonts/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-*.r2.dev",
      },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // the service worker must always be fetched fresh, and may control the whole site
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
