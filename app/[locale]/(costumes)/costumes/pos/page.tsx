import { withModule }         from "@/lib/auth/session"
import { getItemsForPOS }     from "@/lib/actions/costumes/pos"
import { CaisseGuard }        from "@/components/caisse/CaisseGuard"
import { CostumesPOSClient }  from "@/components/costumes/pos/CostumesPOSClient"

export default async function CostumesPOSPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }            = await params
  const authSession           = await withModule("costumes", "pos")
  const { items, lookupById } = await getItemsForPOS()

  return (
    <CaisseGuard portal="costumes" locale={locale} role={authSession.user.role}>
      <CostumesPOSClient
        items={items}
        lookupById={lookupById}
        locale={locale}
        role={authSession.user.role}
      />
    </CaisseGuard>
  )
}