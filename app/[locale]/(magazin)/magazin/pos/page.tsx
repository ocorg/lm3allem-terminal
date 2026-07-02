import { withModule }          from "@/lib/auth/session"
import { getProductsForPOS }   from "@/lib/actions/magazin/pos"
import { CaisseGuard }         from "@/components/caisse/CaisseGuard"
import { POSClient }           from "@/components/magazin/pos/POSClient"
import React from "react"

export default async function POSPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }    = await params
  const authSession   = await withModule("magazin", "pos")
  const { products, categories, lookupById } = await getProductsForPOS()

  return (
    <CaisseGuard portal="magazin" locale={locale} role={authSession.user.role}>
      <POSClient
        products={products}
        categories={categories}
        lookupById={lookupById}
        locale={locale}
        role={authSession.user.role}
      />
    </CaisseGuard>
  )
}