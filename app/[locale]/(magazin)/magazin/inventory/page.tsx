import { withModule }                  from "@/lib/auth/session"
import { getInventory, getLookupValuesForInventory, getSizesAndColors } from "@/lib/actions/magazin/inventory"
import { ProductTable }                from "@/components/magazin/inventory/ProductTable"

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }  = await params
  const authSession = await withModule("magazin", "inventory")

  const [products, { categories, lookupById }, { sizes, colors }] = await Promise.all([
    getInventory(),
    getLookupValuesForInventory(),
    getSizesAndColors(),
  ])

  return (
    <ProductTable
      products={products}
      categories={categories}
      sizes={sizes}
      colors={colors}
      lookupById={lookupById}
      role={authSession.user.role}
      locale={locale}
    />
  )
}