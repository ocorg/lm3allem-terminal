import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/guard"
import ChangePasswordForm from "@/components/auth/ChangePasswordForm"
import React from "react"

export default async function ChangePasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}`)

  return <ChangePasswordForm locale={locale} forced={user.mustChangePassword} />
}
