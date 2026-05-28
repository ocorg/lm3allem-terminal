import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
import { routing } from "@/lib/i18n/routing"
import { auth } from "@/lib/auth/auth"
import "@/app/globals.css"
import { Toaster } from "@/components/ui/Toaster"

export const viewport = {
  themeColor: "#C9A84C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: "Lm3allem Terminal",
  description: "Plateforme de gestion interne — Lm3allem Clothing",
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as "fr" | "ar")) {
    notFound()
  }

  const messages = await getMessages()
  const session = await auth()

  const theme = session?.user?.preferredTheme ?? "dark"
  const dir = locale === "ar" ? "rtl" : "ltr"

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme={theme}
      className={theme === "dark" ? "dark" : "light"}
    >
      <head>
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Lm3allem" />
      <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    </head>
    <body>
        <NextIntlClientProvider messages={messages}>
          <Toaster />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}