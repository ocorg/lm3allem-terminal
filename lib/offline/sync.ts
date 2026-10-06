"use client"

import { createSale, type CreateSaleInput } from "@/lib/actions/magazin/pos"
import { createCostumeSale, type CreateCostumeSaleInput } from "@/lib/actions/costumes/pos"
import { isNetworkError } from "@/lib/client/online"
import { listQueuedSales, removeQueuedSale, updateQueuedSale, type QueuedSale } from "@/lib/offline/queue"

/** Errors that say nothing about the sale itself: keep it queued and try again later. */
const RETRY_LATER = new Set(["server_error", "maintenance"])
/** The session is gone: stop and wait for the user to log in again (the sales stay safe on the device). */
const NEEDS_LOGIN = new Set(["unauthorized", "password_change_required"])

export interface SyncResult {
  synced:  number
  failed:  number
  waiting: number
  /** the connection is still down or the session expired: nothing more to do right now */
  stopped: "offline" | "login" | null
}

let running = false

async function send(sale: QueuedSale) {
  return sale.kind === "magazin"
    ? createSale(sale.payload as unknown as CreateSaleInput)
    : createCostumeSale(sale.payload as unknown as CreateCostumeSaleInput)
}

/**
 * Sends queued sales one by one, in the order they were made.
 * - accepted               -> removed from the queue
 * - refused for a real reason (stock gone, register closed...) -> kept as "failed" with the reason, for a human to decide
 * - connection problem     -> stays queued, stops the loop
 */
export async function syncQueuedSales(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, waiting: 0, stopped: null }
  if (running) return result
  running = true

  try {
    const queue = (await listQueuedSales()).filter((s) => s.status === "pending")
    for (const sale of queue) {
      let res
      try {
        res = await send(sale)
      } catch (err) {
        if (isNetworkError(err)) { result.stopped = "offline"; break }
        throw err
      }

      if (res.ok) {
        await removeQueuedSale(sale.requestId)
        result.synced++
      } else if (NEEDS_LOGIN.has(res.code)) {
        result.stopped = "login"
        break
      } else if (RETRY_LATER.has(res.code)) {
        await updateQueuedSale({ ...sale, attempts: sale.attempts + 1 })
        result.waiting++
      } else {
        await updateQueuedSale({ ...sale, status: "failed", error: res.message, attempts: sale.attempts + 1 })
        result.failed++
      }
    }
    return result
  } finally {
    running = false
  }
}
