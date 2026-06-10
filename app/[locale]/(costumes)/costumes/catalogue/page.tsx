import { withModule }              from "@/lib/auth/session"
import { getCostumeCatalogue }     from "@/lib/actions/costumes/catalogue"
import { CostumesCatalogueGrid }   from "@/components/costumes/catalogue/CostumesCatalogueGrid"

export default async function CostumesCataloguePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }  = await params
  await withModule("costumes", "catalogue")

  const { items, sizes, colors, costumeTypes, lookupById } = await getCostumeCatalogue()

  return (
    <CostumesCatalogueGrid
      items={items}
      sizes={sizes}
      colors={colors}
      costumeTypes={costumeTypes}
      lookupById={lookupById}
      locale={locale}
    />
  )
}