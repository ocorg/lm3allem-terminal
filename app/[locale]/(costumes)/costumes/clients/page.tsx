import { withModule }  from "@/lib/auth/session"
import { getClients }  from "@/lib/actions/costumes/clients"
import { ClientsClient } from "@/components/costumes/clients/ClientsClient"
import React from "react"

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale }  = await params
  const authSession = await withModule("costumes", "clients")
  const clients     = await getClients()

  return (
    <ClientsClient
      clients={clients}
      role={authSession.user.role}
      locale={locale}
    />
  )
}