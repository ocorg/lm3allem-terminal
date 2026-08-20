import { withModule }                        from "@/lib/auth/session"
import { getRentals, getRentalItems }        from "@/lib/actions/costumes/rentals"
import { getClients }                        from "@/lib/actions/costumes/clients"
import { CaisseGuard }                       from "@/components/caisse/CaisseGuard"
import { RentalsClient }                     from "@/components/costumes/rentals/RentalsClient"
import React from "react"

export default async function RentalsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }  = await params
  const authSession = await withModule("costumes", "rentals")

  const [
    rentals,
    { items: costumeItems, lookupById },
    clients,
  ] = await Promise.all([
    getRentals(),
    getRentalItems(),
    getClients(),
  ])

  return (
    <CaisseGuard portal="costumes" locale={locale} role={authSession.user.role}>
      <RentalsClient
        rentals={rentals}
        costumeItems={costumeItems}
        clients={clients}
        lookupById={lookupById}
        role={authSession.user.role}
      />
    </CaisseGuard>
  )
}