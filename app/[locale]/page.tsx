import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/guard"
import LoginScreen from "@/components/auth/LoginScreen"
import { isAdminRole } from "@/lib/permissions"
import React from "react"

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user = await getCurrentUser()

  if (user) {
    if (user.mustChangePassword) redirect(`/${locale}/change-password`)
    if (!isAdminRole(user.role) && user.portalAccess.length === 1) {
      redirect(`/${locale}/${user.portalAccess[0]}`)
    }
    redirect(`/${locale}/select-portal`)
  }

  return <LoginScreen locale={locale} />
}
