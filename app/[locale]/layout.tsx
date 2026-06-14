import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
import { routing } from "@/lib/i18n/routing"
import { auth } from "@/lib/auth/auth"
import "@/app/globals.css"
import { Toaster } from "@/components/ui/Toaster"
import LocaleHtmlAttributes from "@/components/LocaleHtmlAttributes"

export const viewport = {
  themeColor: "#C9A84C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: "Lm3allem Terminal",
  description: "منصة الإدارة الداخلية — Lm3allem Clothing",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lm3allem",
  },
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as "ar")) {
    notFound()
  }

  const messages = await getMessages()
  const session = await auth()

  const theme = session?.user?.preferredTheme ?? "light"
  const dir = locale === "ar" ? "rtl" : "ltr"

  return (
    <>
      <LocaleHtmlAttributes locale={locale} dir={dir} theme={theme} />
      <NextIntlClientProvider messages={messages}>
        <Toaster />
        {children}
      </NextIntlClientProvider>
    </>
  )
}