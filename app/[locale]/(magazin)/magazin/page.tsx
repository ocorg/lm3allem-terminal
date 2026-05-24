import { auth }         from "@/lib/auth/auth"
import { CaisseGuard }  from "@/components/caisse/CaisseGuard"

export default async function MagazinPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }  = await params
  const authSession = await auth()
  const role        = authSession!.user.role

  return (
    <CaisseGuard portal="magazin" locale={locale} role={role}>
      <MagazinDashboard />
    </CaisseGuard>
  )
}

function MagazinDashboard() {
  return (
    <div style={{ padding: 8 }}>
      <p
        style={{
          fontSize:      22,
          fontWeight:    700,
          color:         "var(--text)",
          letterSpacing: "-0.02em",
          marginBottom:  8,
        }}
      >
        Magazin
      </p>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Phase 4 — à venir.
      </p>
    </div>
  )
}