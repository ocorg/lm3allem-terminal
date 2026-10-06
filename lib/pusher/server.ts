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
