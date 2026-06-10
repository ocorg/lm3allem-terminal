import { withModule }         from "@/lib/auth/session"
import { getItemsForPOS }     from "@/lib/actions/costumes/pos"
import { CaisseGuard }        from "@/components/caisse/CaisseGuard"
import { CostumesPOSClient }  from "@/components/costumes/pos/CostumesPOSClient"

export default async function CostumesPOSPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }      = await params
  const authSession     = await withModule("costumes", "pos")

  let items:        Awaited<ReturnType<typeof getItemsForPOS>>["items"]        = []
  let costumeTypes: Awaited<ReturnType<typeof getItemsForPOS>>["costumeTypes"] = []
  let lookupById:   Awaited<ReturnType<typeof getItemsForPOS>>["lookupById"]   = {}

  try {
    const data   = await getItemsForPOS()
    items        = data.items
    costumeTypes = data.costumeTypes
    lookupById   = data.lookupById
  } catch (e) {
    console.error("[costumes/pos] getItemsForPOS failed:", e)
  }

  return (
    <CaisseGuard portal="costumes" locale={locale} role={authSession.user.role}>
      <CostumesPOSClient
        items={items}
        costumeTypes={costumeTypes}
        lookupById={lookupById}
        locale={locale}
        role={authSession.user.role}
      />
    </CaisseGuard>
  )
}