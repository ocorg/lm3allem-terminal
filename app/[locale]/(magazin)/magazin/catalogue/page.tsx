import { withModule }        from "@/lib/auth/session"
import { getCatalogueProducts } from "@/lib/actions/magazin/catalogue"
import { CatalogueGrid }     from "@/components/magazin/catalogue/CatalogueGrid"

export default async function CataloguePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  await withModule("magazin", "catalogue")

  const { products, categories, sizes, colors, lookupById } =
    await getCatalogueProducts()

  return (
    <CatalogueGrid
      products={products}
      categories={categories}
      sizes={sizes}
      colors={colors}
      lookupById={lookupById}
      locale={locale}
    />
  )
}