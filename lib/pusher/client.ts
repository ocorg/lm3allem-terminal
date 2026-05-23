import PusherClient from "pusher-js"

let pusher: PusherClient | null = null

export function getPusherClient(): PusherClient {
  if (pusher) return pusher

  pusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster:      process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    authEndpoint: "/api/pusher/auth",
  })

  return pusher
}