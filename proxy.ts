import { auth } from "@/lib/auth/auth"
import createMiddleware from "next-intl/middleware"
import { routing } from "@/lib/i18n/routing"
import { NextResponse, type NextRequest } from "next/server"

const handleI18n = createMiddleware(routing)

/** first screen of each portal */
const PORTAL_HOME: Record<string, string> = { magazin: "pos", costumes: "pos", lm3allem: "dashboard" }

export default auth((req) => {
  const { nextUrl } = req
  const session = req.auth
  const pathname = nextUrl.pathname

  // Never intercept API routes (they authenticate themselves) or static files
  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  const isAuthenticated = !!session?.user

  // Determine current locale from path
  const detectedLocale =
    routing.locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)) ??
    routing.defaultLocale

  // The login page is the only public route (e.g. /ar)
  const isLoginPage = pathname === `/${detectedLocale}` || pathname === `/${detectedLocale}/`

  if (!isAuthenticated && !isLoginPage) {
    return NextResponse.redirect(new URL(`/${detectedLocale}`, nextUrl))
  }

  // A pending password change (temporary / reset password) blocks everything except that page
  const changePasswordPath = `/${detectedLocale}/change-password`
  if (isAuthenticated && session?.user.mustChangePassword && pathname !== changePasswordPath) {
    return NextResponse.redirect(new URL(changePasswordPath, nextUrl))
  }

  // A bare portal address goes to its first screen right here, as a plain HTTP redirect.
  // (Doing it inside the page, behind the loading screen, is slower and can crash the page.)
  const portal = PORTAL_HOME[pathname.replace(/\/$/, "").slice(`/${detectedLocale}/`.length)]
  if (portal && pathname.startsWith(`/${detectedLocale}/`)) {
    return NextResponse.redirect(new URL(`${pathname.replace(/\/$/, "")}/${portal}`, nextUrl))
  }

  // Delegate locale routing to next-intl
  return handleI18n(req as NextRequest)
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|sw\\.js|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
