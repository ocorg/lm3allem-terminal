import { withModule }              from "@/lib/auth/session"
import { getRequests, getRequestCategories } from "@/lib/actions/magazin/requests"
import { RequestList }             from "@/components/magazin/requests/RequestList"
import React from "react"

export default async function RequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }  = await params
  const authSession = await withModule("magazin", "requests")

  const [requests, categories] = await Promise.all([
    getRequests(),
    getRequestCategories(),
  ])

  return (
    <RequestList
      requests={requests}
      categories={categories}
      role={authSession.user.role}
      locale={locale}
    />
  )
}