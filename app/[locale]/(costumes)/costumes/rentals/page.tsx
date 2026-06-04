import { withModule }                        from "@/lib/auth/session"
import { getRentals, getRentalLookups }      from "@/lib/actions/costumes/rentals"
import { getRentalItems }                    from "@/lib/actions/costumes/rentals"
import { getClients }                        from "@/lib/actions/costumes/clients"
import { CaisseGuard }                       from "@/components/caisse/CaisseGuard"
import { RentalsClient }                     from "@/components/costumes/rentals/RentalsClient"

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
    { measurementCategories },
  ] = await Promise.all([
    getRentals(),
    getRentalItems(),
    getClients(),
    getRentalLookups(),
  ])

  return (
    <CaisseGuard portal="costumes" locale={locale} role={authSession.user.role}>
      <RentalsClient
        rentals={rentals}
        costumeItems={costumeItems}
        clients={clients}
        measurementCategories={measurementCategories}
        lookupById={lookupById}
        role={authSession.user.role}
        locale={locale}
      />
    </CaisseGuard>
  )
}