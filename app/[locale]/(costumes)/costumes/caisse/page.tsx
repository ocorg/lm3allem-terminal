import { withModule }               from "@/lib/auth/session"
import { getActiveSession }         from "@/lib/actions/caisse"
import { getCostumesSessionStats }  from "@/lib/actions/costumes/caisse"
import { CaisseGuard }              from "@/components/caisse/CaisseGuard"
import { CostumesCaisseClient }     from "@/components/costumes/caisse/CostumesCaisseClient"
import React from "react"

export default async function CostumesCaissePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }  = await params
  const authSession = await withModule("costumes", "caisse")

  return (
    <CaisseGuard portal="costumes" locale={locale} role={authSession.user.role}>
      <CaissePageContent role={authSession.user.role} />
    </CaisseGuard>
  )
}

async function CaissePageContent({ role }: { role: string }) {
  const session = await getActiveSession("costumes")
  if (!session) return null

  const stats = await getCostumesSessionStats(session.id)

  return (
    <CostumesCaisseClient initialStats={stats} role={role} />
  )
}