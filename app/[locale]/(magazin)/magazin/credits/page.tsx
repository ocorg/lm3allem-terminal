import { withModule }   from "@/lib/auth/session"
import { getCredits }   from "@/lib/actions/magazin/credits"
import { CreditList }   from "@/components/magazin/credits/CreditList"
import React from "react"

export default async function CreditsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }  = await params
  const authSession = await withModule("magazin", "credits")
  const credits     = await getCredits()

  return (
    <CreditList
      credits={credits}
      role={authSession.user.role}
      locale={locale}
    />
  )
}