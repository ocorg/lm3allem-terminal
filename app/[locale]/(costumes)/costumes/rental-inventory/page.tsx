import { withModule }                          from "@/lib/auth/session"
import { getCostumeItems, getInventoryLookups } from "@/lib/actions/costumes/inventory"
import { CostumesInventoryClient }             from "@/components/costumes/inventory/CostumesInventoryClient"

export default async function RentalInventoryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }  = await params
  const authSession = await withModule("costumes", "rental_inventory")

  const [items, { sizes, colors, costumeTypes, lookupById }] = await Promise.all([
    getCostumeItems("rental"),
    getInventoryLookups(),
  ])

  return (
    <CostumesInventoryClient
      items={items}
      segment="rental"
      sizes={sizes}
      colors={colors}
      costumeTypes={costumeTypes}
      lookupById={lookupById}
      role={authSession.user.role}
      locale={locale}
    />
  )
}