import { withModule }          from "@/lib/auth/session"
import { getActiveSession }    from "@/lib/actions/caisse"
import { getSessionStats }     from "@/lib/actions/magazin/caisse"
import { CaisseGuard }         from "@/components/caisse/CaisseGuard"
import { MagazinCaisseClient } from "@/components/magazin/caisse/MagazinCaisseClient"
import React from "react"

export default async function CaissePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }  = await params
  const authSession = await withModule("magazin", "caisse")

  return (
    <CaisseGuard portal="magazin" locale={locale} role={authSession.user.role}>
      <CaissePageContent role={authSession.user.role} />
    </CaisseGuard>
  )
}

// Inner server component - runs only when CaisseGuard confirms session is active
async function CaissePageContent({ role }: { role: string }) {
  const session = await getActiveSession("magazin")
  if (!session) return null   // guarded upstream, shouldn't reach here

  const stats = await getSessionStats(session.id)

  return (
    <MagazinCaisseClient
      initialStats={stats}
      role={role}
    />
  )
}