import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
import { routing } from "@/lib/i18n/routing"
import { auth } from "@/lib/auth/auth"
import "@/app/globals.css"
import { Toaster } from "@/components/ui/Toaster"

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
      <body>
        <NextIntlClientProvider messages={messages}>
          <Toaster />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}