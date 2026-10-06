"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { QUEUE_EVENT, listQueuedSales, type QueuedSale, type QueuedSaleKind } from "@/lib/offline/queue"

/** Sales waiting on this device (live). */
export function useOfflineQueue() {
  const [sales, setSales] = useState<QueuedSale[]>([])

  const reload = useCallback(async () => setSales(await listQueuedSales()), [])

  useEffect(() => {
    let alive = true
    listQueuedSales().then((list) => { if (alive) setSales(list) })
    window.addEventListener(QUEUE_EVENT, reload)
    return () => {
      alive = false
      window.removeEventListener(QUEUE_EVENT, reload)
    }
  }, [reload])

  const pending = useMemo(() => sales.filter((s) => s.status === "pending"), [sales])
  const failed  = useMemo(() => sales.filter((s) => s.status === "failed"), [sales])

  return { sales, pending, failed, reload }
}

/**
 * Quantity already promised to unsent offline sales, per variant / costume item.
 * Subtract it from the stock shown on the POS so the cashier cannot sell the same item twice.
 */
export function useReservedStock(kind: QueuedSaleKind): Record<string, number> {
  const { sales } = useOfflineQueue()
  return useMemo(() => {
    const reserved: Record<string, number> = {}
    for (const sale of sales) {
      // failed sales were refused by the server, they no longer hold stock
      if (sale.kind !== kind || sale.status !== "pending") continue
      for (const [id, qty] of Object.entries(sale.quantities)) reserved[id] = (reserved[id] ?? 0) + qty
    }
    return reserved
  }, [sales, kind])
}
