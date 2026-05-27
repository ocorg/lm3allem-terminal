import { withModule }                          from "@/lib/auth/session"
import { getCostumeItems, getInventoryLookups } from "@/lib/actions/costumes/inventory"
import { CostumesInventoryClient }             from "@/components/costumes/inventory/CostumesInventoryClient"

export default async function CostumesInventoryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }    = await params
  const authSession   = await withModule("costumes", "inventory")

  const [items, { sizes, colors, lookupById }] = await Promise.all([
    getCostumeItems(),
    getInventoryLookups(),
  ])

  return (
    <CostumesInventoryClient
      items={items}
      sizes={sizes}
      colors={colors}
      lookupById={lookupById}
      role={authSession.user.role}
      locale={locale}
    />
  )
}