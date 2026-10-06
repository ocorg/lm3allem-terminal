"use client"

/**
 * Sales made while the internet is down are stored on THIS device (IndexedDB) and sent to the server
 * when the connection returns. Each one keeps the same idempotency key (requestId), so even if a sale
 * was already received before the connection dropped, sending it again can never duplicate it.
 *
 * IndexedDB is deliberately NOT cleared at logout: unsent sales must survive until they are synced.
 */

export type QueuedSaleKind = "magazin" | "costumes"

export interface QueuedSale {
  requestId:   string
  kind:        QueuedSaleKind
  /** the exact input of createSale / createCostumeSale */
  payload:     Record<string, unknown>
  createdAt:   number
  totalAmount: number
  itemCount:   number
  /** quantity sold per variant / costume item, used to keep the local stock honest while offline */
  quantities:  Record<string, number>
  status:      "pending" | "failed"
  error?:      string
  attempts:    number
}

const DB_NAME = "lm3allem-offline"
const STORE   = "sales"
export const QUEUE_EVENT = "lm3allem:queue-changed"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "requestId" })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror   = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

function notify() {
  window.dispatchEvent(new CustomEvent(QUEUE_EVENT))
}

export async function enqueueSale(sale: Omit<QueuedSale, "status" | "attempts" | "createdAt">): Promise<void> {
  await withStore("readwrite", (s) => s.put({ ...sale, createdAt: Date.now(), status: "pending", attempts: 0 } satisfies QueuedSale))
  notify()
}

export async function listQueuedSales(): Promise<QueuedSale[]> {
  try {
    const all = await withStore<QueuedSale[]>("readonly", (s) => s.getAll())
    return all.sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    return []
  }
}

export async function updateQueuedSale(sale: QueuedSale): Promise<void> {
  await withStore("readwrite", (s) => s.put(sale))
  notify()
}

export async function removeQueuedSale(requestId: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(requestId))
  notify()
}
