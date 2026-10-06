import type { ReactNode } from "react"
import PortalLayout from "@/components/layout/PortalLayout"
import React from "react"

export default async function MagazinLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return (
    <PortalLayout portal="magazin" locale={locale}>
      {children}
    </PortalLayout>
  )
}
