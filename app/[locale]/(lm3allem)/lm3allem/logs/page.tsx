import { getLogs, getActors } from "@/lib/actions/lm3allem/logs"
import { LogsClient } from "@/components/lm3allem/logs/LogsClient"

type SearchParams = Promise<{
  portal?: string
  entityType?: string
  actorId?: string
  from?: string
  to?: string
  page?: string
}>

export default async function LogsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const [result, actors] = await Promise.all([
    getLogs({
      portal: sp.portal,
      entityType: sp.entityType,
      actorId: sp.actorId,
      from: sp.from,
      to: sp.to,
      page: sp.page ? parseInt(sp.page, 10) : 1,
    }),
    getActors(),
  ])
  return <LogsClient result={result} actors={actors} currentFilters={sp} />
}