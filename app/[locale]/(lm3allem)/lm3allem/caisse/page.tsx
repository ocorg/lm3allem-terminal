import { getAllSessions } from "@/lib/actions/lm3allem/caisse"
import { CaisseHistoryClient } from "@/components/lm3allem/caisse/CaisseHistoryClient"
import React from "react"

type SearchParams = Promise<{
  portal?: string
  status?: string
  from?: string
  to?: string
  page?: string
}>

export default async function CaissePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const result = await getAllSessions({
    portal: sp.portal as "magazin" | "costumes" | undefined,
    status:  sp.status  as "open" | "closed" | undefined,
    from:    sp.from,
    to:      sp.to,
    page:    sp.page ? parseInt(sp.page, 10) : 1,
  })
  return <CaisseHistoryClient result={result} filters={sp} />
}