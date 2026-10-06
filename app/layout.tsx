import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { IBM_Plex_Sans_Arabic } from "next/font/google"
import { getCurrentUser } from "@/lib/auth/guard"

// Self-hosted at build time: no request to Google when the app runs (important for a shop terminal
// with a flaky connection).
// ONE family for everything (Arabic, Latin and digits): a plain, solid text face. Its digits all
// have the same width, so amounts line up in columns.
const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
})

/**
 * The theme is resolved ON THE SERVER (cookie first, then the user's saved preference), so the
 * first paint already has the right colours: no dark flash for light-theme users. The app is
 * Arabic-only for now, so lang/dir are static and also correct on the very first byte.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const store = await cookies()
  const cookieTheme = store.get("lm3allem-theme")?.value
  const user = await getCurrentUser()
  const theme = cookieTheme === "dark" || cookieTheme === "light" ? cookieTheme : (user?.preferredTheme ?? "light")

  return (
    <html
      lang="ar"
      dir="rtl"
      data-theme={theme}
      className={`${theme} ${plex.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  )
}
