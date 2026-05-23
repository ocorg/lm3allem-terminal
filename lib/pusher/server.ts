import Pusher from "pusher"

let pusher: Pusher | null = null

export function getPusherServer(): Pusher {
  if (pusher) return pusher

  pusher = new Pusher({
    appId:   process.env.PUSHER_APP_ID!,
    key:     process.env.PUSHER_KEY!,
    secret:  process.env.PUSHER_SECRET!,
    cluster: process.env.PUSHER_CLUSTER!,
    useTLS:  true,
  })

  return pusher
}

// Typed channel/event constants — prevents typos across the app
export const PUSHER_CHANNELS = {
  RENTALS:    "private-rentals",
  ALERTS:     "private-alerts",
  CAISSE:     "private-caisse",
} as const

export const PUSHER_EVENTS = {
  RENTAL_CREATED:       "rental:created",
  RENTAL_STATUS_CHANGED:"rental:status-changed",
  OVERDUE_ALERT:        "alert:overdue",
  LOW_STOCK_ALERT:      "alert:low-stock",
  CAISSE_OPENED:        "caisse:opened",
  CAISSE_CLOSED:        "caisse:closed",
} as const