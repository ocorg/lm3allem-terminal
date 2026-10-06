import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
import { routing } from "@/lib/i18n/routing"
import "@/app/globals.css"
import { Toaster } from "@/components/ui/Toaster"
import NetworkStatus from "@/components/system/NetworkStatus"
import { BrokenImageGuard } from "@/components/system/BrokenImageGuard"
import ServiceWorkerRegister from "@/components/system/ServiceWorkerRegister"
import React from "react"

// Pinch-zoom stays enabled (WCAG 1.4.4): no maximumScale / userScalable restriction.
export const viewport: Viewport = {
  themeColor: "#353535",
  width: "device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "Lm3allem Terminal",
  description: "منصة الإدارة الداخلية - Lm3allem Clothing",
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

  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound()
  }

  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      <Toaster />
      <NetworkStatus />
      <BrokenImageGuard />
      <ServiceWorkerRegister />
      {children}
    </NextIntlClientProvider>
  )
}
