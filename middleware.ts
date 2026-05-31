import { auth } from "@/lib/auth/auth"
import createMiddleware from "next-intl/middleware"
import { routing } from "@/lib/i18n/routing"
import { NextResponse, type NextRequest } from "next/server"

const handleI18n = createMiddleware(routing)

export default auth((req) => {
  const { nextUrl } = req
  const session = req.auth
  const pathname = nextUrl.pathname

  // Never intercept API routes or static files
  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  const isAuthenticated = !!session

  // Determine current locale from path
  const detectedLocale =
    routing.locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)) ??
    routing.defaultLocale

  // The PIN entry page is the only public route (e.g. /fr or /ar)
  const isPinPage = pathname === `/${detectedLocale}` || pathname === `/${detectedLocale}/`

  if (!isAuthenticated && !isPinPage) {
    return NextResponse.redirect(new URL(`/${detectedLocale}`, nextUrl))
  }

  // Delegate locale routing to next-intl
  return handleI18n(req as NextRequest)
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}