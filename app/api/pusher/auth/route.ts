import { NextRequest, NextResponse } from "next/server"
import { auth }            from "@/lib/auth/auth"
import { getPusherServer } from "@/lib/pusher/server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body         = await req.text()
  const params       = new URLSearchParams(body)
  const socketId     = params.get("socket_id")    ?? ""
  const channelName  = params.get("channel_name") ?? ""

  const authResponse = getPusherServer().authorizeChannel(socketId, channelName)
  return NextResponse.json(authResponse)
}