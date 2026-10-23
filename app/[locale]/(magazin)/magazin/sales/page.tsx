import { withModule }     from "@/lib/auth/session"
import { getSalesList }   from "@/lib/actions/magazin/sales"
import { SalesClient }    from "@/components/magazin/sales/SalesClient"
import React from "react"

type SearchParams = Promise<{ from?: string; to?: string; q?: string; returned?: string; page?: string }>

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

export default async function SalesPage({
  params,
  searchParams,
}: {
  params:       Promise<{ locale: string }>
  searchParams: SearchParams
}) {
  const { locale }  = await params
  const authSession = await withModule("magazin", "pos", locale)
  const sp = await searchParams

  // Only well-formed values reach the server action (anything else is simply ignored)
  const filters = {
    from:     sp.from && DAY_KEY.test(sp.from) ? sp.from : undefined,
    to:       sp.to && DAY_KEY.test(sp.to) ? sp.to : undefined,
    q:        sp.q?.trim().slice(0, 80) || undefined,
    returned: sp.returned === "1" || undefined,
    page:     Math.min(10_000, Math.max(1, parseInt(sp.page ?? "1", 10) || 1)),
  }
  const result = await getSalesList(filters)

  return (
    <SalesClient
      result={result}
      filters={{ from: filters.from ?? "", to: filters.to ?? "", q: filters.q ?? "", returned: !!filters.returned }}
      locale={locale}
      role={authSession.user.role}
    />
  )
}
