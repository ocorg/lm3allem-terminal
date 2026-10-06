import type { ReactNode } from "react"
import PortalLayout from "@/components/layout/PortalLayout"
import React from "react"

export default async function CostumesLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return (
    <PortalLayout portal="costumes" locale={locale}>
      {children}
    </PortalLayout>
  )
}
